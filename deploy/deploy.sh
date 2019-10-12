#!/bin/bash
set -e
echo Deploy image $IMAGE_NAME:$CI_TIMESTAMP
scp -v $USER_NAME@$HOST_NAME ./deploy/charts ./charts/cep
ssh -v $USER_NAME@$HOST_NAME helm upgrade tribeca-cep ./charts/cep \
    --set image.tag=$IMAGE_NAME:$CI_TIMESTAMP \
    --set deployment.env.externalHttpHost=$EXTERNAL_HTTP_HOST \
    --install --wait

