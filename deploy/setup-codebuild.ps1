#!/usr/bin/env pwsh
# AWS CodeBuild Setup (No Docker Desktop needed!)
# This creates AWS CodeBuild projects that build and deploy your app

param(
    [string]$AwsRegion = "us-east-1"
)

function Write-Info { Write-Host "[INFO] $args" -ForegroundColor Green }
function Write-Warn { Write-Host "[WARN] $args" -ForegroundColor Yellow }
function Write-Err { Write-Host "[ERROR] $args" -ForegroundColor Red }

Write-Info "Setting up AWS CodeBuild..."

# Get Account ID
$AccountId = aws sts get-caller-identity --query Account --output text
Write-Info "Account ID: $AccountId"

# Create IAM role for CodeBuild
Write-Info "Creating CodeBuild IAM role..."

$CodeBuildTrustPolicy = @{
    Version = "2012-10-17"
    Statement = @(
        @{
            Effect = "Allow"
            Principal = @{
                Service = "codebuild.amazonaws.com"
            }
            Action = "sts:AssumeRole"
        }
    )
} | ConvertTo-Json -Depth 10

$CodeBuildTrustPolicy | Out-File -FilePath "codebuild-trust-policy.json" -Encoding UTF8 -Force

aws iam create-role `
  --role-name CodeBuildServiceRole `
  --assume-role-policy-document file://codebuild-trust-policy.json `
  --region $AwsRegion 2>$null

# Attach policies
aws iam attach-role-policy `
  --role-name CodeBuildServiceRole `
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser `
  --region $AwsRegion 2>$null

aws iam attach-role-policy `
  --role-name CodeBuildServiceRole `
  --policy-arn arn:aws:iam::aws:policy/CloudWatchLogsFullAccess `
  --region $AwsRegion 2>$null

# Create inline policy for ECS updates
$EcsPolicy = @{
    Version = "2012-10-17"
    Statement = @(
        @{
            Effect = "Allow"
            Action = @(
                "ecs:UpdateService",
                "ecs:DescribeServices"
            )
            Resource = "*"
        }
    )
} | ConvertTo-Json -Depth 10

$EcsPolicy | Out-File -FilePath "ecs-policy.json" -Encoding UTF8 -Force

aws iam put-role-policy `
  --role-name CodeBuildServiceRole `
  --policy-name AllowECSUpdates `
  --policy-document file://ecs-policy.json `
  --region $AwsRegion

Remove-Item "codebuild-trust-policy.json", "ecs-policy.json" -Force
Write-Info "CodeBuild IAM role created"

# Wait for role to be available
Start-Sleep -Seconds 5

# Create API CodeBuild project
Write-Info "Creating API CodeBuild project..."

$ApiBuildProject = @{
    name = "rentarvo-api-build"
    source = @{
        type = "GITHUB"
        location = "https://github.com/edquad/rentarvo.git"
        buildspec = "buildspec-api.yml"
    }
    artifacts = @{
        type = "NO_ARTIFACTS"
    }
    environment = @{
        type = "LINUX_CONTAINER"
        computeType = "BUILD_GENERAL1_SMALL"
        image = "aws/codebuild/standard:7.0"
        environmentVariables = @(
            @{
                name = "AWS_ACCOUNT_ID"
                value = $AccountId
                type = "PLAINTEXT"
            }
            @{
                name = "AWS_DEFAULT_REGION"
                value = $AwsRegion
                type = "PLAINTEXT"
            }
            @{
                name = "IMAGE_REPO_NAME"
                value = "rentarvo-api"
                type = "PLAINTEXT"
            }
        )
        privilegedMode = $true
    }
    serviceRole = "arn:aws:iam::$AccountId`:role/CodeBuildServiceRole"
} | ConvertTo-Json -Depth 10

$ApiBuildProject | Out-File -FilePath "api-build-project.json" -Encoding UTF8 -Force
aws codebuild create-project --cli-input-json file://api-build-project.json --region $AwsRegion 2>$null
Remove-Item "api-build-project.json" -Force
Write-Info "API CodeBuild project created"

# Create UI CodeBuild project
Write-Info "Creating UI CodeBuild project..."

$UiBuildProject = @{
    name = "rentarvo-ui-build"
    source = @{
        type = "GITHUB"
        location = "https://github.com/edquad/rentarvo.git"
        buildspec = "buildspec-ui.yml"
    }
    artifacts = @{
        type = "NO_ARTIFACTS"
    }
    environment = @{
        type = "LINUX_CONTAINER"
        computeType = "BUILD_GENERAL1_SMALL"
        image = "aws/codebuild/standard:7.0"
        environmentVariables = @(
            @{
                name = "AWS_ACCOUNT_ID"
                value = $AccountId
                type = "PLAINTEXT"
            }
            @{
                name = "AWS_DEFAULT_REGION"
                value = $AwsRegion
                type = "PLAINTEXT"
            }
            @{
                name = "IMAGE_REPO_NAME"
                value = "rentarvo-ui"
                type = "PLAINTEXT"
            }
        )
        privilegedMode = $true
    }
    serviceRole = "arn:aws:iam::$AccountId`:role/CodeBuildServiceRole"
} | ConvertTo-Json -Depth 10

$UiBuildProject | Out-File -FilePath "ui-build-project.json" -Encoding UTF8 -Force
aws codebuild create-project --cli-input-json file://ui-build-project.json --region $AwsRegion 2>$null
Remove-Item "ui-build-project.json" -Force
Write-Info "UI CodeBuild project created"

Write-Info ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "CodeBuild Setup Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Push code to GitHub" -ForegroundColor Cyan
Write-Host "2. Add GitHub secrets:" -ForegroundColor Cyan
Write-Host "   - AWS_ACCESS_KEY_ID" -ForegroundColor Gray
Write-Host "   - AWS_SECRET_ACCESS_KEY" -ForegroundColor Gray
Write-Host "   - AWS_ACCOUNT_ID = $AccountId" -ForegroundColor Gray
Write-Host "3. Push to main branch triggers automatic deployment" -ForegroundColor Cyan
Write-Host ""
