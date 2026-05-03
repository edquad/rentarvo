# Deploy to AWS Without Docker (CodeBuild)

Deploy Rentarvo to AWS **without needing Docker Desktop** using AWS CodeBuild.

## 🎯 How It Works

1. **You push code to GitHub**
2. **GitHub Actions triggers AWS CodeBuild**
3. **AWS builds Docker images** (in AWS cloud, not locally)
4. **AWS pushes to ECR** and deploys to ECS
5. **Your app is live** ✅

**No Docker Desktop needed!** ✨

---

## 📋 Prerequisites

✅ AWS Account (configured)  
✅ GitHub Account with repo  
✅ AWS CLI configured  
✓ Code pushed to GitHub  

---

## Step 1: Create GitHub Repository

```powershell
# Initialize git (if not done)
cd c:\Users\varun\Desktop\project\fati\rentarvo
git init
git add .
git commit -m "Initial commit"

# Add remote (replace USERNAME with your GitHub username)
git remote add origin https://github.com/edquad/rentarvo.git

# Push to GitHub
git branch -M main
git push -u origin main
```

---

## Step 2: Create GitHub Secrets

1. Go to: **GitHub** → Your repo → **Settings** → **Secrets and variables** → **Actions**

2. Click **New repository secret** and add:

| Secret Name | Value |
|------------|-------|
| `AWS_ACCESS_KEY_ID` | AKIA... |
| `AWS_SECRET_ACCESS_KEY` | cCzho... |
| `AWS_ACCOUNT_ID` | 303268632093 |

---

## Step 3: Set Up CodeBuild Projects

Run this once:

```powershell
cd c:\Users\varun\Desktop\project\fati\rentarvo

# Create CodeBuild projects
.\deploy\setup-codebuild.ps1
```

This creates:
- `rentarvo-api-build` project (builds API)
- `rentarvo-ui-build` project (builds UI)

---

## Step 4: Connect GitHub to CodeBuild

GitHub Actions already set up to trigger CodeBuild when you push!

The file `.github/workflows/codebuild-deploy.yml` does this.

---

## Step 5: Deploy

### First Deployment (Full Setup)

```powershell
# 1. Create RDS database
aws rds create-db-instance `
  --db-instance-identifier rentarvo-prod `
  --db-instance-class db.t3.micro `
  --engine postgres `
  --engine-version 16 `
  --allocated-storage 20 `
  --master-username rentarvo `
  --master-user-password YourSecurePassword123! `
  --db-name rentarvo `
  --publicly-accessible false `
  --region us-east-1

# 2. Wait for RDS (5-10 minutes)
aws rds wait db-instance-available --db-instance-identifier rentarvo-prod --region us-east-1

# 3. Create ECS cluster
aws ecs create-cluster --cluster-name rentarvo-prod --region us-east-1

# 4. Get RDS endpoint
$RDS_ENDPOINT = aws rds describe-db-instances `
  --db-instance-identifier rentarvo-prod `
  --region us-east-1 `
  --query 'DBInstances[0].Endpoint.Address' `
  --output text

Write-Host "RDS Endpoint: $RDS_ENDPOINT"
```

### Subsequent Deployments

Just push code to GitHub:

```powershell
git add .
git commit -m "Update code"
git push origin main
```

Then:
1. GitHub Actions triggers
2. AWS CodeBuild builds
3. Images pushed to ECR
4. ECS deployment updated

---

## 🚀 Deploy Now

```powershell
# Step 1: Push code to GitHub
cd c:\Users\varun\Desktop\project\fati\rentarvo
git push origin main

# Step 2: Set up CodeBuild
.\deploy\setup-codebuild.ps1

# Step 3: Set GitHub secrets (see Step 2 above)

# Step 4: Watch deployment
# Go to: https://github.com/edquad/rentarvo/actions
```

---

## ✅ Check Deployment Status

### GitHub Actions
```
https://github.com/edquad/rentarvo/actions
```

### CodeBuild Logs
```powershell
aws codebuild batch-get-builds --ids build-id --region us-east-1
```

### ECS Services
```powershell
aws ecs list-services --cluster rentarvo-prod --region us-east-1

aws ecs describe-services \
  --cluster rentarvo-prod \
  --services rentarvo-api rentarvo-ui \
  --region us-east-1
```

---

## 🔍 Troubleshooting

### CodeBuild failed to find buildspec
- Check file is in repo root: `buildspec-api.yml` and `buildspec-ui.yml`

### GitHub can't access AWS
- Verify secrets are set correctly
- Check GitHub Actions permissions

### CodeBuild can't push to ECR
- Ensure IAM role has ECR permissions
- Check ECR repositories exist

---

## 💰 Cost (Free Tier)

- **CodeBuild**: 100 minutes/month free
- **ECS Fargate**: 750 hours/month free
- **RDS**: 750 hours/month free
- **ECR**: ~$0.50/month storage
- **Total**: ~$6/year

---

## 📊 Architecture

```
GitHub Repo
    ↓
Push to main branch
    ↓
GitHub Actions
    ↓
Trigger CodeBuild
    ↓
CodeBuild builds Docker images
    ↓
Push to ECR
    ↓
Deploy to ECS
    ↓
Your app is live!
```

---

## Next: Create ECS Services

Once CodeBuild is set up, create the ECS services:

```powershell
# Get VPC info
$VPC_ID = aws ec2 describe-vpcs `
  --filters Name=isDefault,Values=true `
  --query 'Vpcs[0].VpcId' `
  --output text `
  --region us-east-1

$SUBNETS = aws ec2 describe-subnets `
  --filters Name=vpc-id,Values=$VPC_ID `
  --query 'Subnets[0:2].SubnetId' `
  --output text `
  --region us-east-1

# Create security group
$SG_ID = aws ec2 create-security-group `
  --group-name rentarvo-sg `
  --description "Rentarvo ECS" `
  --vpc-id $VPC_ID `
  --query 'GroupId' `
  --output text `
  --region us-east-1

# Allow traffic
aws ec2 authorize-security-group-ingress `
  --group-id $SG_ID `
  --protocol tcp `
  --port 3000 `
  --cidr 0.0.0.0/0 `
  --region us-east-1

aws ec2 authorize-security-group-ingress `
  --group-id $SG_ID `
  --protocol tcp `
  --port 80 `
  --cidr 0.0.0.0/0 `
  --region us-east-1

Write-Host "VPC: $VPC_ID"
Write-Host "Subnets: $SUBNETS"
Write-Host "Security Group: $SG_ID"
```

Then use these IDs to register task definitions and create ECS services.

See [WINDOWS_AWS_SETUP.md](WINDOWS_AWS_SETUP.md) for complete ECS setup.
