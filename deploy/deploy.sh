#!/bin/bash
set -e
echo Deploy image $IMAGE_NAME:$CI_TIMESTAMP
scp -v -r ./var/www/deploy/charts/** $USER_NAME@$HOST_NAME:./charts/$IMAGE_NAME/
ssh -v $USER_NAME@$HOST_NAME helm upgrade $IMAGE_NAME ./charts/$IMAGE_NAME \
    --set image.tag=$IMAGE_NAME:$CI_TIMESTAMP \
    --set deployment.env.externalHttpHost=$EXTERNAL_HTTP_HOST \
    --install --wait

