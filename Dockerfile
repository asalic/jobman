FROM node:24-alpine

LABEL name=jobman-webservice
LABEL authors="Andy S Alic (asalic)"

COPY release.sh jest.config.* package.json tsconfig.json README.md LICENSE OpenAPI-3.1-specs.json /tmp/jobman/
COPY src /tmp/jobman/src
COPY bin /tmp/jobman/bin

WORKDIR /tmp/jobman

RUN apk add jq \
    && ./release.sh webservice \
    && tar -xvf build/jobman.tar.gz -C /opt \
    && rm -rf /root/.npm /tmp/jobman \
    && ln -s /opt/jobman/bin/jobman-webservice /usr/bin/ \
    && chmod +x /opt/jobman/bin/jobman-webservice

ENV SETTINGS_FILE=/opt/jobman/src/webservice/settings.json

WORKDIR /opt/jobman

USER node

ENTRYPOINT ["jobman-webservice"] 
CMD ["-s", "/opt/jobman/settings.json"]
