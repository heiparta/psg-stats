FROM nodesource/trusty:0.12.4

COPY . /app

RUN cd /app; npm install; npm install -g nodemon

EXPOSE 8080

WORKDIR /app
CMD ["nodemon", "app.js"]

