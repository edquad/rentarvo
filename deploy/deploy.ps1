#!/usr/bin/env pwsh
# Rentarvo AWS Deployment Script (Windows PowerShell)
# Deploys API and UI to AWS ECS free tier

param(
    [string]$RDSPassword = "YourSecurePassword123!",
    [string]$JWTSecret = "your-jwt-secret-change-this",
    [string]$AwsRegion = "us-east-1"
)

# Colors
function Write-Info { Write-Host "[INFO] $args" -ForegroundColor Green }
function Write-Warn { Write-Host "[WARN] $args" -ForegroundColor Yellow }
function Write-Err { Write-Host "[ERROR] $args" -ForegroundColor Red }

# Check prerequisites
Write-Info "Checking prerequisites..."
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Err "AWS CLI not installed"
    exit 1
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Err "Docker not installed"
    exit 1
}
Write-Info "Prerequisites OK"

# Get AWS Account ID
Write-Info "Getting AWS Account ID..."
$AccountId = aws sts get-caller-identity --query Account --output text
Write-Info "Account ID: $AccountId"

# Create repositories
Write-Info "Creating ECR repositories..."
aws ecr create-repository --repository-name rentarvo-api --region $AwsRegion 2>$null
aws ecr create-repository --repository-name rentarvo-ui --region $AwsRegion 2>$null
Write-Info "ECR repositories created"

# Create RDS
Write-Info "Creating RDS database (10 mins)..."
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

Write-Warn "Waiting for RDS (this takes 5-10 minutes)..."
aws rds wait db-instance-available --db-instance-identifier rentarvo-prod --region $AwsRegion
Write-Info "RDS ready"

$RdsEndpoint = aws rds describe-db-instances `
  --db-instance-identifier rentarvo-prod `
  --region $AwsRegion `
  --query 'DBInstances[0].Endpoint.Address' `
  --output text

Write-Info "RDS Endpoint: $RdsEndpoint"

# Create ECS cluster
Write-Info "Creating ECS cluster..."
aws ecs create-cluster --cluster-name rentarvo-prod --region $AwsRegion 2>$null
Write-Info "ECS cluster created"

# Login to ECR
Write-Info "Logging in to ECR..."
$RegistryUrl = "$AccountId.dkr.ecr.$AwsRegion.amazonaws.com"
aws ecr get-login-password --region $AwsRegion | docker login --username AWS --password-stdin $RegistryUrl

# Build and push images
Write-Info "Building API image..."
docker build -f rentarvo-api/Dockerfile -t rentarvo-api:latest .
docker tag rentarvo-api:latest "$RegistryUrl/rentarvo-api:latest"
Write-Info "Pushing API image..."
docker push "$RegistryUrl/rentarvo-api:latest"

Write-Info "Building UI image..."
docker build -f rentarvo-ui/Dockerfile -t rentarvo-ui:latest .
docker tag rentarvo-ui:latest "$RegistryUrl/rentarvo-ui:latest"
Write-Info "Pushing UI image..."
docker push "$RegistryUrl/rentarvo-ui:latest"
Write-Info "Images pushed to ECR"

# Create IAM roles
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

$TrustPolicy | Out-File -FilePath "trust-policy.json" -Encoding UTF8 -Force
aws iam create-role --role-name ecsTaskExecutionRole --assume-role-policy-document file://trust-policy.json --region $AwsRegion 2>$null
aws iam attach-role-policy --role-name ecsTaskExecutionRole --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy --region $AwsRegion 2>$null
aws iam create-role --role-name ecsTaskRole --assume-role-policy-document file://trust-policy.json --region $AwsRegion 2>$null
Remove-Item "trust-policy.json" -Force
Write-Info "IAM roles created"

# Create log groups
Write-Info "Creating log groups..."
aws logs create-log-group --log-group-name /ecs/rentarvo-api --region $AwsRegion 2>$null
aws logs create-log-group --log-group-name /ecs/rentarvo-ui --region $AwsRegion 2>$null
Write-Info "Log groups created"

# Get VPC info
Write-Info "Getting VPC information..."
$VpcId = aws ec2 describe-vpcs --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text --region $AwsRegion
$Subnets = aws ec2 describe-subnets --filters Name=vpc-id,Values=$VpcId --query 'Subnets[*].SubnetId' --output text --region $AwsRegion
$SubnetArray = $Subnets -split '\s+' | Where-Object {$_}
$Subnet1 = $SubnetArray[0]
$Subnet2 = if ($SubnetArray.Count -gt 1) { $SubnetArray[1] } else { $SubnetArray[0] }

# Create security group
Write-Info "Creating security group..."
$SgId = aws ec2 create-security-group `
  --group-name rentarvo-ecs-sg `
  --description "Security group for Rentarvo ECS" `
  --vpc-id $VpcId `
  --region $AwsRegion `
  --query 'GroupId' `
  --output text

aws ec2 authorize-security-group-ingress --group-id $SgId --protocol tcp --port 3000 --cidr 0.0.0.0/0 --region $AwsRegion 2>$null
aws ec2 authorize-security-group-ingress --group-id $SgId --protocol tcp --port 80 --cidr 0.0.0.0/0 --region $AwsRegion 2>$null
Write-Info "Security group created"

# Register task definitions
Write-Info "Registering task definitions..."
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
    executionRoleArn = "arn:aws:iam::$AccountId`:role/ecsTaskExecutionRole"
    taskRoleArn = "arn:aws:iam::$AccountId`:role/ecsTaskRole"
} | ConvertTo-Json -Depth 10

$ApiTaskDef | Out-File -FilePath "api-task-def.json" -Encoding UTF8 -Force
aws ecs register-task-definition --cli-input-json file://api-task-def.json --region $AwsRegion 2>$null
Remove-Item "api-task-def.json" -Force

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
    executionRoleArn = "arn:aws:iam::$AccountId`:role/ecsTaskExecutionRole"
} | ConvertTo-Json -Depth 10

$UiTaskDef | Out-File -FilePath "ui-task-def.json" -Encoding UTF8 -Force
aws ecs register-task-definition --cli-input-json file://ui-task-def.json --region $AwsRegion 2>$null
Remove-Item "ui-task-def.json" -Force
Write-Info "Task definitions registered"

# Create services
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

Write-Info "Services created"

# Wait and get IPs
Write-Warn "Waiting for tasks to start (2-3 minutes)..."
Start-Sleep -Seconds 30

$ApiTask = aws ecs list-tasks --cluster rentarvo-prod --service-name rentarvo-api --region $AwsRegion --query 'taskArns[0]' --output text

if ($ApiTask) {
    $ApiTaskDetails = aws ecs describe-tasks --cluster rentarvo-prod --tasks $ApiTask --region $AwsRegion | ConvertFrom-Json
    $ApiEni = $ApiTaskDetails.tasks[0].attachments | Where-Object {$_.type -eq 'ElasticNetworkInterface'} | Select-Object -ExpandProperty details | Where-Object {$_.name -eq 'networkInterfaceId'} | Select-Object -ExpandProperty value
    
    if ($ApiEni) {
        $ApiIp = aws ec2 describe-network-interfaces --network-interface-ids $ApiEni --region $AwsRegion --query 'NetworkInterfaces[0].Association.PublicIp' --output text
        Write-Host ""
        Write-Host "============================================" -ForegroundColor Cyan
        Write-Host "    DEPLOYMENT SUCCESSFUL!" -ForegroundColor Green
        Write-Host "============================================" -ForegroundColor Cyan
        Write-Host "API:  http://$ApiIp`:3000" -ForegroundColor Yellow
        Write-Host "UI:   http://$ApiIp" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Email:    owner@rentarvo.local" -ForegroundColor Cyan
        Write-Host "Password: Rentarvo!2026" -ForegroundColor Cyan
        Write-Host "============================================" -ForegroundColor Cyan
        Write-Host ""
    }
}

Write-Info "Deployment complete!"
