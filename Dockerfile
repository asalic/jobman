FROM debian:sid-slim

LABEL name=jobman
LABEL authors="Andy S Alic (asalic)"

RUN apt-get -y update \
    && apt-get -y install curl bash vim \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs

COPY jest.config.* package-lock.json package.json tsconfig.json /opt/jobman/
COPY src /opt/jobman/src
COPY bin /opt/jobman/bin

RUN cd /opt/jobman/ \
    && npm install \
    && npx tsc \
    && ln -s /opt/jobman/bin/jobman-webservice /usr/bin/ \
    && addgroup jobman --gid 1001 && useradd -m -u 1001 -g jobman jobman

ENV SETTINGS_FILE /opt/jobman/src/webservice/settings.json

USER jobman

ENTRYPOINT jobman-webservice -s ${SETTINGS_FILE}