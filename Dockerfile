FROM python:alpine

RUN apk add --no-cache jq npm git

RUN pip install awscli

COPY . /canary

WORKDIR /canary

RUN npm install && npm run build

ENTRYPOINT ["/canary/entrypoint.sh"]