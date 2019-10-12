echo Publishing image $IMAGE_NAME:$CI_TIMESTAMP
docker login -u $DOCKER_USERNAME -p $DOCKER_PASSWORD
docker tag $IMAGE_NAME:$CI_TIMESTAMP $IMAGE_NAME:latest
docker push $IMAGE_NAME:$CI_TIMESTAMP
docker push $IMAGE_NAME:latest