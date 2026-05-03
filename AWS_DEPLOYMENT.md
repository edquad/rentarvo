# AWS Deployment Guide for Rentarvo

This guide covers deploying the Rentarvo API and UI as separate microservices on AWS.

## Architecture Overview

- **rentarvo-api**: Node.js/Express backend deployed on AWS ECS
- **rentarvo-ui**: React SPA served from AWS S3 + CloudFront
- **Database**: AWS RDS PostgreSQL
- **CI/CD**: GitHub Actions

## Prerequisites

- AWS Account with appropriate permissions
- GitHub repository with secrets configured
- Docker installed locally for testing
- AWS CLI configured

## Step 1: Set Up AWS Infrastructure

### 1.1 Create RDS PostgreSQL Database

```bash
# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier rentarvo-prod \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 16 \
  --allocated-storage 20 \
  --storage-type gp2 \
  --master-username rentarvo \
  --master-user-password YOUR_SECURE_PASSWORD \
  --db-name rentarvo \
  --publicly-accessible false \
  --vpc-security-group-ids sg-xxxxxxxxx
```

### 1.2 Create ECR Repositories

```bash
# Create repository for API
aws ecr create-repository --repository-name rentarvo-api --region us-east-1

# Create repository for UI
aws ecr create-repository --repository-name rentarvo-ui --region us-east-1
```

### 1.3 Create S3 Bucket for UI Assets

```bash
# Create bucket
aws s3 mb s3://rentarvo-ui-prod --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket rentarvo-ui-prod \
  --versioning-configuration Status=Enabled

# Enable public read access (if needed)
aws s3api put-bucket-acl --bucket rentarvo-ui-prod --acl public-read
```

## Step 2: Create ECS Cluster

```bash
# Create ECS cluster
aws ecs create-cluster --cluster-name rentarvo-prod

# Register task definition for API
aws ecs register-task-definition --cli-input-json file://ecs-api-task-definition.json

# Register task definition for UI
aws ecs register-task-definition --cli-input-json file://ecs-ui-task-definition.json
```

## Step 3: Set Up GitHub Secrets

Add these secrets to your GitHub repository:

- `AWS_ACCOUNT_ID`: Your AWS Account ID
- `AWS_ACCESS_KEY_ID`: IAM user access key
- `AWS_SECRET_ACCESS_KEY`: IAM user secret key
- `AWS_REGION`: us-east-1
- `DB_PASSWORD`: RDS database password
- `JWT_SECRET`: Your JWT secret key
- `SENTRY_DSN`: Sentry error tracking (optional)

## Step 4: Deploy API

### Manual Deployment

```bash
# Build and push Docker image to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

docker build -f rentarvo-api/Dockerfile -t rentarvo-api:latest .
docker tag rentarvo-api:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/rentarvo-api:latest
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/rentarvo-api:latest

# Update ECS service
aws ecs update-service --cluster rentarvo-prod --service rentarvo-api --force-new-deployment
```

## Step 5: Deploy UI

### Option A: S3 + CloudFront

```bash
# Build the UI
cd rentarvo-ui
pnpm build

# Upload to S3
aws s3 sync dist/ s3://rentarvo-ui-prod --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"
```

### Option B: Use ECS (recommended for server-side features)

Same as API deployment above.

## Step 6: Set Up CloudFront Distribution

```bash
# Create CloudFront distribution pointing to S3
aws cloudfront create-distribution --distribution-config file://cloudfront-config.json
```

## Environment Variables

Create `.env.production` in each service:

### rentarvo-api/.env.production
```
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://rentarvo:PASSWORD@your-rds-endpoint:5432/rentarvo
JWT_SECRET=your_jwt_secret
SENTRY_DSN=your_sentry_dsn
```

### rentarvo-ui/.env.production
```
VITE_API_URL=https://api.rentarvo.com
VITE_SENTRY_DSN=your_sentry_dsn
```

## Monitoring

### CloudWatch Logs

```bash
# View API logs
aws logs tail /ecs/rentarvo-api --follow

# View UI logs
aws logs tail /ecs/rentarvo-ui --follow
```

### Health Checks

The API includes a health endpoint at `/health`. Configure ECS health checks accordingly.

## Scaling

### Auto-scaling for API

```bash
# Register scalable target
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/rentarvo-prod/rentarvo-api \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 2 \
  --max-capacity 10

# Create scaling policy
aws application-autoscaling put-scaling-policy \
  --policy-name rentarvo-api-scaling \
  --service-namespace ecs \
  --resource-id service/rentarvo-prod/rentarvo-api \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration file://scaling-policy.json
```

## Troubleshooting

### Check ECS Task Logs

```bash
# List tasks
aws ecs list-tasks --cluster rentarvo-prod --service-name rentarvo-api

# Describe task
aws ecs describe-tasks --cluster rentarvo-prod --tasks arn:aws:ecs:...
```

### Database Connection Issues

Ensure security groups allow traffic:
- ECS tasks security group → RDS security group (port 5432)
- Load balancer security group → ECS tasks security group (port 3000)

### Deployment Issues

Check GitHub Actions workflow logs in your repository's Actions tab.

## Rollback

```bash
# Update service to previous task definition
aws ecs update-service \
  --cluster rentarvo-prod \
  --service rentarvo-api \
  --task-definition rentarvo-api:PREVIOUS_VERSION
```

## Cost Optimization

- Use t3 instances for lower cost
- Configure RDS auto-pause for development
- Use S3 Intelligent-Tiering
- Enable VPC endpoints to reduce NAT costs
- Use Spot instances for non-critical workloads

## Additional Resources

- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [AWS RDS Documentation](https://docs.aws.amazon.com/rds/)
- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
