FROM python:alpine

RUN apk add --no-cache coreutils jq npm git yarn g++ make nasm autoconf automake

RUN pip install awscli

COPY . /canary

WORKDIR /canary

RUN npm install && npm run build

ENTRYPOINT ["/canary/entrypoint.sh"]
