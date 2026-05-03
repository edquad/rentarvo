# Deployment Guide - Rentarvo

This guide explains how to deploy Rentarvo with the new separated architecture (rentarvo-api and rentarvo-ui) to various environments.

## 📦 Project Structure After Refactoring

```
rentarvo/
├── rentarvo-api/          # Node.js/Express backend
├── rentarvo-ui/           # React frontend
├── packages/shared/       # Shared types and utilities
├── .github/workflows/     # CI/CD pipelines
├── deploy/                # Deployment configurations
└── docker-compose.prod.yml
```

## 🚀 Quick Start - Local Development

### Prerequisites
- Node.js 20+
- pnpm 8+
- Docker & Docker Compose
- PostgreSQL 16

### Option 1: Using pnpm (Recommended for Development)

```bash
# Install dependencies
pnpm install

# Start development servers (both API and UI)
pnpm dev

# API runs on http://localhost:3000
# UI runs on http://localhost:5173

# Database commands
pnpm db:migrate      # Run migrations
pnpm db:seed         # Seed database
pnpm db:studio       # Open Prisma Studio
```

### Option 2: Using Docker Compose

```bash
# Start local development environment
docker-compose up -d

# Create .env file for local development
cp .env.example .env

# Run migrations
pnpm db:migrate

# API runs on http://localhost:3000
# UI runs on http://localhost:5173
# PostgreSQL runs on localhost:5432
# pgAdmin runs on http://localhost:5050
```

## 🐳 Docker & Container Deployment

### Building Images Locally

```bash
# Build API image
docker build -f rentarvo-api/Dockerfile -t rentarvo-api:latest .

# Build UI image
docker build -f rentarvo-ui/Dockerfile -t rentarvo-ui:latest .

# Test locally with production compose file
docker-compose -f docker-compose.prod.yml up
```

### Environment Variables for Production

Create `.env` file:

```bash
# Database
DB_USER=rentarvo
DB_PASSWORD=your_secure_password_here
DB_NAME=rentarvo

# API
NODE_ENV=production
JWT_SECRET=your_jwt_secret_key
SENTRY_DSN=your_sentry_dsn_url

# UI
VITE_API_URL=https://api.your-domain.com
```

## ☁️ AWS Deployment

### Prerequisites

1. **AWS Account** with appropriate permissions
2. **GitHub Repository** with deployment secrets configured
3. **AWS CLI** installed and configured
4. **Docker** installed locally

### Step 1: Configure AWS Secrets

Add these secrets to GitHub repository settings:

```
AWS_ACCOUNT_ID          - Your AWS Account ID
AWS_ACCESS_KEY_ID       - IAM user access key
AWS_SECRET_ACCESS_KEY   - IAM user secret key
AWS_REGION              - us-east-1 (or your preferred region)
DB_PASSWORD             - RDS database password
JWT_SECRET              - Your JWT secret
SENTRY_DSN              - (Optional) Sentry monitoring
```

### Step 2: Setup AWS Infrastructure

```bash
# Create RDS PostgreSQL database
aws rds create-db-instance \
  --db-instance-identifier rentarvo-prod \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 16 \
  --allocated-storage 20 \
  --master-username rentarvo \
  --master-user-password <DB_PASSWORD>

# Create ECR repositories
aws ecr create-repository --repository-name rentarvo-api
aws ecr create-repository --repository-name rentarvo-ui

# Create ECS cluster
aws ecs create-cluster --cluster-name rentarvo-prod
```

### Step 3: Deploy via CI/CD (Recommended)

Push to `main` or `develop` branch:

```bash
git add .
git commit -m "Deploy update"
git push origin main
```

The GitHub Actions workflow will automatically:
1. Run lint, type-check, and tests
2. Build Docker images
3. Push to ECR
4. Deploy to ECS
5. Invalidate CloudFront cache (UI only)

### Step 4: Manual Deployment

If you need to deploy manually:

```bash
# Set environment variables
export AWS_ACCOUNT_ID=123456789012
export AWS_REGION=us-east-1

# Use the deployment script
chmod +x deploy/deploy-to-aws.sh
./deploy/deploy-to-aws.sh
```

## 🔄 Deployment Workflow

### Automatic Deployment (CI/CD)

1. Developer pushes to `main` branch
2. GitHub Actions workflow triggers:
   - **Lint & Test**: Runs ESLint, TypeScript, and unit tests
   - **Build & Push**: Only rebuilds services with changes
   - **Deploy**: Updates ECS services
3. Services are updated and redeployed

### What Gets Deployed?

- **API Changes** → Rebuilds `rentarvo-api` container → Deploys to ECS
- **UI Changes** → Rebuilds `rentarvo-ui` container → Deploys to ECS + S3 + CloudFront
- **Shared Changes** → Rebuilds and deploys both services

## 📊 Monitoring & Logs

### View Logs

```bash
# API logs
aws logs tail /ecs/rentarvo-api --follow

# UI logs
aws logs tail /ecs/rentarvo-ui --follow

# Check service status
aws ecs describe-services --cluster rentarvo-prod --services rentarvo-api rentarvo-ui
```

### Health Checks

API includes `/health` endpoint. Check it:

```bash
curl https://api.your-domain.com/health
```

## 🔙 Rollback

If deployment goes wrong:

```bash
# Get previous task definition
aws ecs describe-services --cluster rentarvo-prod --services rentarvo-api

# Update service to previous version
aws ecs update-service \
  --cluster rentarvo-prod \
  --service rentarvo-api \
  --task-definition rentarvo-api:PREVIOUS_VERSION
```

## 📈 Scaling

### Auto-scaling Configuration

The Dockerfiles and ECS configuration support horizontal scaling. Configure in AWS:

```bash
# Register scalable target
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/rentarvo-prod/rentarvo-api \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 2 \
  --max-capacity 10
```

## 🔐 Security Best Practices

1. **Never commit secrets** - Use GitHub Secrets and AWS Secrets Manager
2. **Use HTTPS** - Configure CloudFront/ALB with SSL certificates
3. **Database backups** - Enable RDS automated backups
4. **Security groups** - Restrict inbound traffic appropriately
5. **API rate limiting** - Configured in Express middleware
6. **CORS** - Configure based on your domain
7. **Environment-specific configs** - Different settings per environment

## 💰 Cost Optimization

- Use **t3.micro** for development/staging
- Use **Spot Instances** for non-critical workloads
- **VPC Endpoints** reduce NAT costs
- **S3 Intelligent-Tiering** for storage
- **CloudFront caching** reduces origin load
- **RDS multi-AZ** only for production

## 🆘 Troubleshooting

### Deployment fails with "Image not found"

- Ensure ECR repositories exist
- Check AWS credentials in GitHub Secrets
- Verify Docker build completes successfully locally

### Database connection fails

- Ensure RDS security group allows traffic from ECS
- Check DATABASE_URL is correct
- Verify database exists and credentials are right
- Test with: `psql postgresql://user:password@host/db`

### UI shows blank page

- Check `VITE_API_URL` is configured correctly
- Verify API is accessible from browser
- Check browser console for CORS errors
- Ensure CloudFront cache is invalidated

### Out of memory / OOMKilled

- Increase ECS task memory in task definition
- Check for memory leaks in application
- Monitor CloudWatch metrics

## 📚 Additional Resources

- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [AWS RDS Documentation](https://docs.aws.amazon.com/rds/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Documentation](https://docs.docker.com/)
- [Project README](./README.md)
- [AWS Deployment Guide](./AWS_DEPLOYMENT.md)
