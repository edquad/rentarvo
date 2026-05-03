#!/bin/bash

# Rentarvo AWS Deployment Script
# This script automates the deployment of Rentarvo to AWS ECS

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
AWS_ACCOUNT_ID=${AWS_ACCOUNT_ID:-}
AWS_REGION=${AWS_REGION:-us-east-1}
CLUSTER_NAME="rentarvo-prod"
API_REPOSITORY="rentarvo-api"
UI_REPOSITORY="rentarvo-ui"

# Functions
print_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
  print_info "Checking prerequisites..."
  
  if [ -z "$AWS_ACCOUNT_ID" ]; then
    print_error "AWS_ACCOUNT_ID environment variable not set"
    exit 1
  fi
  
  if ! command -v aws &> /dev/null; then
    print_error "AWS CLI not found. Please install it first."
    exit 1
  fi
  
  if ! command -v docker &> /dev/null; then
    print_error "Docker not found. Please install it first."
    exit 1
  fi
  
  print_info "All prerequisites met"
}

login_to_ecr() {
  print_info "Logging in to Amazon ECR..."
  aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
}

build_and_push_api() {
  print_info "Building and pushing API image..."
  
  local ECR_REGISTRY="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
  local IMAGE_TAG=$(git rev-parse --short HEAD)
  local IMAGE_URI="$ECR_REGISTRY/$API_REPOSITORY:$IMAGE_TAG"
  local LATEST_URI="$ECR_REGISTRY/$API_REPOSITORY:latest"
  
  docker build -f rentarvo-api/Dockerfile -t "$IMAGE_URI" -t "$LATEST_URI" .
  
  print_info "Pushing $IMAGE_URI..."
  docker push "$IMAGE_URI"
  docker push "$LATEST_URI"
  
  print_info "API image pushed successfully"
}

build_and_push_ui() {
  print_info "Building and pushing UI image..."
  
  local ECR_REGISTRY="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
  local IMAGE_TAG=$(git rev-parse --short HEAD)
  local IMAGE_URI="$ECR_REGISTRY/$UI_REPOSITORY:$IMAGE_TAG"
  local LATEST_URI="$ECR_REGISTRY/$UI_REPOSITORY:latest"
  
  docker build -f rentarvo-ui/Dockerfile -t "$IMAGE_URI" -t "$LATEST_URI" .
  
  print_info "Pushing $IMAGE_URI..."
  docker push "$IMAGE_URI"
  docker push "$LATEST_URI"
  
  print_info "UI image pushed successfully"
}

deploy_to_ecs() {
  local SERVICE=$1
  
  print_info "Deploying $SERVICE to ECS..."
  
  aws ecs update-service \
    --cluster $CLUSTER_NAME \
    --service $SERVICE \
    --force-new-deployment \
    --region $AWS_REGION
  
  print_info "$SERVICE deployment initiated"
  
  # Wait for deployment to complete
  print_info "Waiting for deployment to complete..."
  aws ecs wait services-stable \
    --cluster $CLUSTER_NAME \
    --services $SERVICE \
    --region $AWS_REGION
  
  print_info "$SERVICE deployed successfully"
}

# Main script
main() {
  print_info "Starting Rentarvo deployment to AWS..."
  
  check_prerequisites
  login_to_ecr
  
  read -p "Deploy API? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    build_and_push_api
    deploy_to_ecs "rentarvo-api"
  fi
  
  read -p "Deploy UI? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    build_and_push_ui
    deploy_to_ecs "rentarvo-ui"
  fi
  
  print_info "Deployment completed!"
}

main "$@"
