# Quick AWS Free Tier Deployment Guide for Windows

Complete guide to deploy Rentarvo on AWS free tier in ~30 minutes.

## Step 1: Install AWS CLI (5 minutes)

```powershell
# Option A: Download installer
# https://awscli.amazonaws.com/AWSCLIV2.msi

# Option B: Using winget (if installed)
winget install Amazon.AWSCLI

# Verify installation
aws --version
```

## Step 2: Configure AWS Credentials (5 minutes)

```powershell
# Open AWS Console: https://console.aws.amazon.com

# 1. Go to IAM → Users → Create User
#    Name: rentarvo-deployer
#    ✓ Provide user access to AWS Management Console
#    ✓ I want to create an IAM user

# 2. Set permissions: AdministratorAccess (easiest for personal project)

# 3. Create access key:
#    Security credentials tab → Create access key → Command Line Interface (CLI)
#    Download .csv file and KEEP IT SAFE!

# Now configure locally:
aws configure

# When prompted, enter:
# AWS Access Key ID: [from CSV]
# AWS Secret Access Key: [from CSV]
# Default region name: us-east-1
# Default output format: json

# Verify it works
aws sts get-caller-identity
```

## Step 3: Create AWS Infrastructure (10 minutes)

```powershell
# 1. Create ECR repositories (Docker image storage)
aws ecr create-repository --repository-name rentarvo-api --region us-east-1
aws ecr create-repository --repository-name rentarvo-ui --region us-east-1

# 2. Create RDS PostgreSQL database (FREE TIER: db.t3.micro, 20GB)
aws rds create-db-instance `
  --db-instance-identifier rentarvo-prod `
  --db-instance-class db.t3.micro `
  --engine postgres `
  --engine-version 16 `
  --allocated-storage 20 `
  --storage-type gp2 `
  --master-username rentarvo `
  --master-user-password YourSecurePassword123! `
  --db-name rentarvo `
  --publicly-accessible false `
  --region us-east-1

# ⏳ Wait 5-10 minutes for RDS to be ready
# Check status:
aws rds describe-db-instances --db-instance-identifier rentarvo-prod --region us-east-1

# 3. Create ECS Cluster
aws ecs create-cluster --cluster-name rentarvo-prod --region us-east-1

# 4. Get RDS endpoint (you'll need this)
$rdsEndpoint = aws rds describe-db-instances `
  --db-instance-identifier rentarvo-prod `
  --region us-east-1 `
  --query 'DBInstances[0].Endpoint.Address' `
  --output text

Write-Host "RDS Endpoint: $rdsEndpoint"
```

## Step 4: Get AWS Account ID (1 minute)

```powershell
$AWS_ACCOUNT_ID = aws sts get-caller-identity --query Account --output text
Write-Host "Your AWS Account ID: $AWS_ACCOUNT_ID"

# Save it, you'll use it multiple times
$env:AWS_ACCOUNT_ID = $AWS_ACCOUNT_ID
```

## Step 5: Login to ECR and Build Images (10 minutes)

```powershell
# Login to ECR
$region = "us-east-1"
$registryUrl = "$env:AWS_ACCOUNT_ID.dkr.ecr.$region.amazonaws.com"

aws ecr get-login-password --region $region | docker login --username AWS --password-stdin $registryUrl

# Build API image
cd c:\Users\varun\Desktop\project\fati\rentarvo
docker build -f rentarvo-api/Dockerfile -t rentarvo-api:latest .

# Tag for ECR
docker tag rentarvo-api:latest "$registryUrl/rentarvo-api:latest"

# Push to ECR
docker push "$registryUrl/rentarvo-api:latest"

# Build UI image
docker build -f rentarvo-ui/Dockerfile -t rentarvo-ui:latest .

# Tag and push UI
docker tag rentarvo-ui:latest "$registryUrl/rentarvo-ui:latest"
docker push "$registryUrl/rentarvo-ui:latest"

Write-Host "✅ Docker images pushed to ECR"
```

## Step 6: Create IAM Roles for ECS (5 minutes)

```powershell
# Create ECS Task Execution Role
$trustPolicy = @{
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

$trustPolicy | Out-File -FilePath "trust-policy.json" -Encoding UTF8

aws iam create-role `
  --role-name ecsTaskExecutionRole `
  --assume-role-policy-document file://trust-policy.json `
  --region us-east-1

# Attach policy
aws iam attach-role-policy `
  --role-name ecsTaskExecutionRole `
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy `
  --region us-east-1

# Create Task Role (for application permissions)
aws iam create-role `
  --role-name ecsTaskRole `
  --assume-role-policy-document file://trust-policy.json `
  --region us-east-1

Remove-Item "trust-policy.json"
Write-Host "✅ IAM roles created"
```

## Step 7: Register ECS Task Definitions

### API Task Definition

```powershell
$apiTaskDef = @{
    family = "rentarvo-api"
    networkMode = "awsvpc"
    requiresCompatibilities = @("FARGATE")
    cpu = "256"
    memory = "512"
    containerDefinitions = @(
        @{
            name = "rentarvo-api"
            image = "$registryUrl/rentarvo-api:latest"
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
                @{ name = "DATABASE_URL"; value = "postgresql://rentarvo:YourSecurePassword123!@$rdsEndpoint:5432/rentarvo" }
                @{ name = "JWT_SECRET"; value = "your-jwt-secret-change-this" }
            )
            logConfiguration = @{
                logDriver = "awslogs"
                options = @{
                    "awslogs-group" = "/ecs/rentarvo-api"
                    "awslogs-region" = $region
                    "awslogs-stream-prefix" = "ecs"
                }
            }
        }
    )
    executionRoleArn = "arn:aws:iam::$env:AWS_ACCOUNT_ID`:role/ecsTaskExecutionRole"
    taskRoleArn = "arn:aws:iam::$env:AWS_ACCOUNT_ID`:role/ecsTaskRole"
} | ConvertTo-Json -Depth 10

$apiTaskDef | Out-File -FilePath "api-task-def.json" -Encoding UTF8

aws ecs register-task-definition `
  --cli-input-json file://api-task-def.json `
  --region us-east-1

Remove-Item "api-task-def.json"
```

### UI Task Definition

```powershell
$uiTaskDef = @{
    family = "rentarvo-ui"
    networkMode = "awsvpc"
    requiresCompatibilities = @("FARGATE")
    cpu = "256"
    memory = "512"
    containerDefinitions = @(
        @{
            name = "rentarvo-ui"
            image = "$registryUrl/rentarvo-ui:latest"
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
                    "awslogs-region" = $region
                    "awslogs-stream-prefix" = "ecs"
                }
            }
        }
    )
    executionRoleArn = "arn:aws:iam::$env:AWS_ACCOUNT_ID`:role/ecsTaskExecutionRole"
} | ConvertTo-Json -Depth 10

$uiTaskDef | Out-File -FilePath "ui-task-def.json" -Encoding UTF8

aws ecs register-task-definition `
  --cli-input-json file://ui-task-def.json `
  --region us-east-1

Remove-Item "ui-task-def.json"
```

## Step 8: Create CloudWatch Log Groups

```powershell
aws logs create-log-group --log-group-name /ecs/rentarvo-api --region us-east-1
aws logs create-log-group --log-group-name /ecs/rentarvo-ui --region us-east-1
```

## Step 9: Create VPC Security Group

```powershell
# Get default VPC ID
$vpcId = aws ec2 describe-vpcs --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text --region us-east-1

# Create security group
$sgId = aws ec2 create-security-group `
  --group-name rentarvo-ecs-sg `
  --description "Security group for Rentarvo ECS services" `
  --vpc-id $vpcId `
  --region us-east-1 `
  --query 'GroupId' `
  --output text

# Allow inbound traffic on port 3000 (API) and 80 (UI)
aws ec2 authorize-security-group-ingress `
  --group-id $sgId `
  --protocol tcp `
  --port 3000 `
  --cidr 0.0.0.0/0 `
  --region us-east-1

aws ec2 authorize-security-group-ingress `
  --group-id $sgId `
  --protocol tcp `
  --port 80 `
  --cidr 0.0.0.0/0 `
  --region us-east-1

Write-Host "Security group ID: $sgId"
```

## Step 10: Get Subnet IDs

```powershell
# Get subnet IDs in default VPC
$subnets = aws ec2 describe-subnets `
  --filters Name=vpc-id,Values=$vpcId `
  --query 'Subnets[*].SubnetId' `
  --output text `
  --region us-east-1

$subnetArray = $subnets -split '\s+' | Where-Object {$_}
Write-Host "Available subnets: $($subnetArray -join ', ')"

# Use first 2 for redundancy
$subnet1 = $subnetArray[0]
$subnet2 = $subnetArray[1]
```

## Step 11: Create ECS Services

### Deploy API Service

```powershell
aws ecs create-service `
  --cluster rentarvo-prod `
  --service-name rentarvo-api `
  --task-definition rentarvo-api:1 `
  --desired-count 1 `
  --launch-type FARGATE `
  --network-configuration "awsvpcConfiguration={subnets=[$subnet1,$subnet2],securityGroups=[$sgId],assignPublicIp=ENABLED}" `
  --region us-east-1

Write-Host "✅ API service created"
```

### Deploy UI Service

```powershell
aws ecs create-service `
  --cluster rentarvo-prod `
  --service-name rentarvo-ui `
  --task-definition rentarvo-ui:1 `
  --desired-count 1 `
  --launch-type FARGATE `
  --network-configuration "awsvpcConfiguration={subnets=[$subnet1,$subnet2],securityGroups=[$sgId],assignPublicIp=ENABLED}" `
  --region us-east-1

Write-Host "✅ UI service created"
```

## Step 12: Get Service URLs

```powershell
# Wait a moment for tasks to start
Start-Sleep -Seconds 5

# Get API public IP
$apiTask = aws ecs list-tasks --cluster rentarvo-prod --service-name rentarvo-api --region us-east-1 --query 'taskArns[0]' --output text

$apiDetails = aws ecs describe-tasks --cluster rentarvo-prod --tasks $apiTask --region us-east-1

$apiEni = $apiDetails | ConvertFrom-Json | Select-Object -ExpandProperty tasks | Select-Object -ExpandProperty attachments | Where-Object {$_.type -eq 'ElasticNetworkInterface'} | Select-Object -ExpandProperty details | Where-Object {$_.name -eq 'networkInterfaceId'} | Select-Object -ExpandProperty value

$apiIp = aws ec2 describe-network-interfaces --network-interface-ids $apiEni --region us-east-1 --query 'NetworkInterfaces[0].Association.PublicIp' --output text

Write-Host "🚀 API URL: http://$apiIp:3000"
Write-Host "🚀 UI URL: http://$apiIp"
```

## Step 13: Set Up GitHub Actions (Optional but Recommended)

The workflow file is already created at `.github/workflows/deploy.yml`

Add these secrets to GitHub:

```
Settings → Secrets and variables → Actions → New repository secret
```

1. `AWS_ACCOUNT_ID` = Your AWS Account ID
2. `AWS_ACCESS_KEY_ID` = From your AWS credentials
3. `AWS_SECRET_ACCESS_KEY` = From your AWS credentials
4. `AWS_REGION` = us-east-1
5. `DB_PASSWORD` = Your RDS password (YourSecurePassword123!)
6. `JWT_SECRET` = Your JWT secret

Now whenever you push to `main` branch, GitHub Actions will automatically:
- Run tests
- Build images
- Push to ECR
- Deploy to ECS

## Troubleshooting

### Check if tasks are running:
```powershell
aws ecs list-tasks --cluster rentarvo-prod --region us-east-1

aws ecs describe-tasks --cluster rentarvo-prod --tasks <task-arn> --region us-east-1
```

### View logs:
```powershell
aws logs tail /ecs/rentarvo-api --follow --region us-east-1

aws logs tail /ecs/rentarvo-ui --follow --region us-east-1
```

### Stop services (to save costs):
```powershell
# Scale down to 0
aws ecs update-service --cluster rentarvo-prod --service rentarvo-api --desired-count 0 --region us-east-1

aws ecs update-service --cluster rentarvo-prod --service rentarvo-ui --desired-count 0 --region us-east-1
```

## Cost Estimation (First Year)

- **ECS Fargate**: FREE (750 hours/month free tier covers both services)
- **RDS PostgreSQL**: FREE (750 hours/month free tier)
- **ECR**: ~$0.50/month (storage only)
- **Data Transfer**: FREE (within AWS regions)

**Total: ~$6/year** (mostly storage)

## Next Steps

1. Run all commands above sequentially
2. Wait ~15 minutes for RDS to be ready
3. Access your application via the URLs printed
4. Test login with default credentials
5. Push code to GitHub and CI/CD will handle future deployments
