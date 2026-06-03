#!/bin/bash
# Create private S3 bucket for Rentarvo documents (leases, bills, photos).
# Requires: AWS CLI configured (aws configure)
#
# Usage:
#   export AWS_REGION=us-east-1
#   export S3_BUCKET_NAME=rentarvo-documents-YOUR_ACCOUNT_ID
#   bash deploy/create-s3-bucket.sh

set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
BUCKET="${S3_BUCKET_NAME:-rentarvo-documents-$(aws sts get-caller-identity --query Account --output text)}"

echo "=== Creating bucket: $BUCKET in $REGION ==="

if [ "$REGION" = "us-east-1" ]; then
  aws s3api create-bucket --bucket "$BUCKET" --region "$REGION"
else
  aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION"
fi

echo "=== Block all public access ==="
aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

echo "=== Enable default encryption ==="
aws s3api put-bucket-encryption --bucket "$BUCKET" \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": { "SSEAlgorithm": "AES256" }
    }]
  }'

echo "=== Lifecycle (optional: abort incomplete multipart after 7 days) ==="
aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "abort-incomplete-multipart",
      "Status": "Enabled",
      "Filter": { "Prefix": "" },
      "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 7 }
    }]
  }' 2>/dev/null || true

echo ""
echo "=== Done ==="
echo "Add these to .env.prod on Lightsail:"
echo "  STORAGE_DRIVER=s3"
echo "  S3_BUCKET=$BUCKET"
echo "  AWS_REGION=$REGION"
echo "  S3_PREFIX=rentarvo"
echo "  AWS_ACCESS_KEY_ID=<from IAM user below>"
echo "  AWS_SECRET_ACCESS_KEY=<from IAM user below>"
echo ""
echo "Create an IAM user with policy: deploy/iam-s3-documents-policy.json"
echo "Attach policy, create access keys, paste into .env.prod, then rebuild API."
