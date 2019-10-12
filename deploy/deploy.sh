#!/bin/bash
set -e
echo Deploy image $IMAGE_NAME:$CI_TIMESTAMP
scp -r ./var/www/deploy/charts/** $USER_NAME@$HOST_NAME:./charts/tribeca-cep/
ssh $USER_NAME@$HOST_NAME helm upgrade tribeca-cep ./charts/tribeca-cep \
    --set image.tag=$IMAGE_NAME:$CI_TIMESTAMP \
    --set deployment.env.externalHttpHost=$EXTERNAL_HTTP_HOST \
    --install --wait

