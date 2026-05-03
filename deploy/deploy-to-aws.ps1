#!/usr/bin/env pwsh
# Rentarvo AWS Deployment Script (Windows PowerShell)
# Run this script to deploy everything in one go

param(
    [string]$RDSPassword = "YourSecurePassword123!",
    [string]$JWTSecret = "your-jwt-secret-change-this",
    [string]$AwsRegion = "us-east-1"
)

# Colors
$Green = [ConsoleColor]::Green
$Yellow = [ConsoleColor]::Yellow
$Red = [ConsoleColor]::Red

function Write-Info {
    Write-Host "[INFO] $args" -ForegroundColor $Green
}

function Write-Warn {
    Write-Host "[WARN] $args" -ForegroundColor $Yellow
}

function Write-Error {
    Write-Host "[ERROR] $args" -ForegroundColor $Red
}

# Check prerequisites
Write-Info "Checking prerequisites..."

if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Error "AWS CLI not installed. Install from: https://aws.amazon.com/cli/"
    exit 1
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "Docker not installed. Install from: https://www.docker.com/products/docker-desktop"
    exit 1
}

Write-Info "✓ AWS CLI installed"
Write-Info "✓ Docker installed"

# Get AWS Account ID
Write-Info "Getting AWS Account ID..."
$AwsAccountId = aws sts get-caller-identity --query Account --output text
Write-Info "AWS Account ID: $AwsAccountId"

# Step 1: Create ECR repositories
Write-Info "Creating ECR repositories..."
aws ecr create-repository --repository-name rentarvo-api --region $AwsRegion 2>$null
aws ecr create-repository --repository-name rentarvo-ui --region $AwsRegion 2>$null
Write-Info "✓ ECR repositories created"

# Step 2: Create RDS PostgreSQL
Write-Info "Creating RDS PostgreSQL database (this takes ~10 minutes)..."
aws rds create-db-instance `
  --db-instance-identifier rentarvo-prod `
  --db-instance-class db.t3.micro `
  --engine postgres `
  --engine-version 16 `
  --allocated-storage 20 `
  --storage-type gp2 `
  --master-username rentarvo `
  --master-user-password $RDSPassword `
  --db-name rentarvo `
  --publicly-accessible false `
  --region $AwsRegion 2>$null

Write-Warn "Waiting for RDS to be ready (this can take 5-10 minutes)..."
aws rds wait db-instance-available --db-instance-identifier rentarvo-prod --region $AwsRegion
Write-Info "✓ RDS database created and ready"

# Get RDS endpoint
Write-Info "Getting RDS endpoint..."
$RdsEndpoint = aws rds describe-db-instances `
  --db-instance-identifier rentarvo-prod `
  --region $AwsRegion `
  --query 'DBInstances[0].Endpoint.Address' `
  --output text

Write-Info "RDS Endpoint: $RdsEndpoint"

# Step 3: Create ECS cluster
Write-Info "Creating ECS cluster..."
aws ecs create-cluster --cluster-name rentarvo-prod --region $AwsRegion 2>$null
Write-Info "✓ ECS cluster created"

# Step 4: Login to ECR
Write-Info "Logging in to ECR..."
$RegistryUrl = "$AwsAccountId.dkr.ecr.$AwsRegion.amazonaws.com"
aws ecr get-login-password --region $AwsRegion | docker login --username AWS --password-stdin $RegistryUrl

# Step 5: Build and push images
Write-Info "Building API Docker image..."
docker build -f rentarvo-api/Dockerfile -t rentarvo-api:latest .
docker tag rentarvo-api:latest "$RegistryUrl/rentarvo-api:latest"
Write-Info "Pushing API image to ECR..."
docker push "$RegistryUrl/rentarvo-api:latest"
Write-Info "✓ API image pushed"

Write-Info "Building UI Docker image..."
docker build -f rentarvo-ui/Dockerfile -t rentarvo-ui:latest .
docker tag rentarvo-ui:latest "$RegistryUrl/rentarvo-ui:latest"
Write-Info "Pushing UI image to ECR..."
docker push "$RegistryUrl/rentarvo-ui:latest"
Write-Info "✓ UI image pushed"

# Step 6: Create IAM roles
Write-Info "Creating IAM roles..."
$TrustPolicy = @{
    Version = "2012-10-17"
    Statement = @(
        @{
            Effect = "Allow"
            Principal = @{
                Service = "ecs-tasks.amazonaws.com"
            }
            Action = "sts:AssumeRole"
        }
    )
} | ConvertTo-Json -Depth 10

$TrustPolicy | Out-File -FilePath "trust-policy.json" -Encoding UTF8

aws iam create-role `
  --role-name ecsTaskExecutionRole `
  --assume-role-policy-document file://trust-policy.json `
  --region $AwsRegion 2>$null

aws iam attach-role-policy `
  --role-name ecsTaskExecutionRole `
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy `
  --region $AwsRegion 2>$null

aws iam create-role `
  --role-name ecsTaskRole `
  --assume-role-policy-document file://trust-policy.json `
  --region $AwsRegion 2>$null

Remove-Item "trust-policy.json"
Write-Info "✓ IAM roles created"

# Step 7: Create CloudWatch log groups
Write-Info "Creating CloudWatch log groups..."
aws logs create-log-group --log-group-name /ecs/rentarvo-api --region $AwsRegion 2>$null
aws logs create-log-group --log-group-name /ecs/rentarvo-ui --region $AwsRegion 2>$null
Write-Info "✓ Log groups created"

# Step 8: Get VPC and subnets
Write-Info "Getting VPC and subnet information..."
$VpcId = aws ec2 describe-vpcs --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text --region $AwsRegion
$Subnets = aws ec2 describe-subnets --filters Name=vpc-id,Values=$VpcId --query 'Subnets[*].SubnetId' --output text --region $AwsRegion
$SubnetArray = $Subnets -split '\s+' | Where-Object {$_}
$Subnet1 = $SubnetArray[0]
$Subnet2 = if ($SubnetArray.Count -gt 1) { $SubnetArray[1] } else { $SubnetArray[0] }

Write-Info "VPC ID: $VpcId"
Write-Info "Subnets: $Subnet1, $Subnet2"

# Step 9: Create security group
Write-Info "Creating security group..."
$SgId = aws ec2 create-security-group `
  --group-name rentarvo-ecs-sg `
  --description "Security group for Rentarvo ECS" `
  --vpc-id $VpcId `
  --region $AwsRegion `
  --query 'GroupId' `
  --output text

aws ec2 authorize-security-group-ingress `
  --group-id $SgId `
  --protocol tcp `
  --port 3000 `
  --cidr 0.0.0.0/0 `
  --region $AwsRegion 2>$null

aws ec2 authorize-security-group-ingress `
  --group-id $SgId `
  --protocol tcp `
  --port 80 `
  --cidr 0.0.0.0/0 `
  --region $AwsRegion 2>$null

Write-Info "Security group ID: $SgId"

# Step 10: Register task definitions
Write-Info "Registering ECS task definitions..."

$DbUrl = "postgresql://rentarvo:$RDSPassword@$RdsEndpoint`:5432/rentarvo"

$ApiTaskDef = @{
    family = "rentarvo-api"
    networkMode = "awsvpc"
    requiresCompatibilities = @("FARGATE")
    cpu = "256"
    memory = "512"
    containerDefinitions = @(
        @{
            name = "rentarvo-api"
            image = "$RegistryUrl/rentarvo-api:latest"
            essential = $true
            portMappings = @(
                @{
                    containerPort = 3000
                    hostPort = 3000
                    protocol = "tcp"
                }
            )
            environment = @(
                @{ name = "NODE_ENV"; value = "production" }
                @{ name = "PORT"; value = "3000" }
                @{ name = "DATABASE_URL"; value = $DbUrl }
                @{ name = "JWT_SECRET"; value = $JWTSecret }
            )
            logConfiguration = @{
                logDriver = "awslogs"
                options = @{
                    "awslogs-group" = "/ecs/rentarvo-api"
                    "awslogs-region" = $AwsRegion
                    "awslogs-stream-prefix" = "ecs"
                }
            }
        }
    )
    executionRoleArn = "arn:aws:iam::$AwsAccountId`:role/ecsTaskExecutionRole"
    taskRoleArn = "arn:aws:iam::$AwsAccountId`:role/ecsTaskRole"
} | ConvertTo-Json -Depth 10

$ApiTaskDef | Out-File -FilePath "api-task-def.json" -Encoding UTF8
aws ecs register-task-definition --cli-input-json file://api-task-def.json --region $AwsRegion 2>$null
Remove-Item "api-task-def.json"

$UiTaskDef = @{
    family = "rentarvo-ui"
    networkMode = "awsvpc"
    requiresCompatibilities = @("FARGATE")
    cpu = "256"
    memory = "512"
    containerDefinitions = @(
        @{
            name = "rentarvo-ui"
            image = "$RegistryUrl/rentarvo-ui:latest"
            essential = $true
            portMappings = @(
                @{
                    containerPort = 80
                    hostPort = 80
                    protocol = "tcp"
                }
            )
            environment = @(
                @{ name = "VITE_API_URL"; value = "http://localhost:3000" }
            )
            logConfiguration = @{
                logDriver = "awslogs"
                options = @{
                    "awslogs-group" = "/ecs/rentarvo-ui"
                    "awslogs-region" = $AwsRegion
                    "awslogs-stream-prefix" = "ecs"
                }
            }
        }
    )
    executionRoleArn = "arn:aws:iam::$AwsAccountId`:role/ecsTaskExecutionRole"
} | ConvertTo-Json -Depth 10

$UiTaskDef | Out-File -FilePath "ui-task-def.json" -Encoding UTF8
aws ecs register-task-definition --cli-input-json file://ui-task-def.json --region $AwsRegion 2>$null
Remove-Item "ui-task-def.json"

Write-Info "✓ Task definitions registered"

# Step 11: Create ECS services
Write-Info "Creating ECS services..."

aws ecs create-service `
  --cluster rentarvo-prod `
  --service-name rentarvo-api `
  --task-definition rentarvo-api:1 `
  --desired-count 1 `
  --launch-type FARGATE `
  --network-configuration "awsvpcConfiguration={subnets=[$Subnet1,$Subnet2],securityGroups=[$SgId],assignPublicIp=ENABLED}" `
  --region $AwsRegion 2>$null

aws ecs create-service `
  --cluster rentarvo-prod `
  --service-name rentarvo-ui `
  --task-definition rentarvo-ui:1 `
  --desired-count 1 `
  --launch-type FARGATE `
  --network-configuration "awsvpcConfiguration={subnets=[$Subnet1,$Subnet2],securityGroups=[$SgId],assignPublicIp=ENABLED}" `
  --region $AwsRegion 2>$null

Write-Info "✓ ECS services created"

# Step 12: Wait for tasks to start and get IPs
Write-Warn "Waiting for tasks to start (this takes ~2-3 minutes)..."
Start-Sleep -Seconds 30

Write-Info "Getting service IPs..."

$ApiTask = aws ecs list-tasks --cluster rentarvo-prod --service-name rentarvo-api --region $AwsRegion --query 'taskArns[0]' --output text

if ($ApiTask) {
    $ApiTaskDetails = aws ecs describe-tasks --cluster rentarvo-prod --tasks $ApiTask --region $AwsRegion | ConvertFrom-Json
    $ApiEni = $ApiTaskDetails.tasks[0].attachments | Where-Object {$_.type -eq 'ElasticNetworkInterface'} | Select-Object -ExpandProperty details | Where-Object {$_.name -eq 'networkInterfaceId'} | Select-Object -ExpandProperty value
    
    if ($ApiEni) {
        $ApiIp = aws ec2 describe-network-interfaces --network-interface-ids $ApiEni --region $AwsRegion --query 'NetworkInterfaces[0].Association.PublicIp' --output text
        Write-Info ""
        Write-Info "🚀 DEPLOYMENT SUCCESSFUL! 🚀"
        Write-Info ""
        Write-Info "API URL: http://$ApiIp:3000"
        Write-Info "UI URL: http://$ApiIp"
        Write-Info ""
        Write-Info "Default credentials:"
        Write-Info "  Email: owner@rentarvo.local"
        Write-Info "  Password: Rentarvo!2026"
        Write-Info ""
    }
}

Write-Info "Deployment complete!"
Write-Info "Check AWS Console at: https://console.aws.amazon.com/ecs"
