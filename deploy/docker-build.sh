echo Building image $IMAGE_NAME:$CI_TIMESTAMP
docker build ./var/www -t $IMAGE_NAME:$CI_TIMESTAMP