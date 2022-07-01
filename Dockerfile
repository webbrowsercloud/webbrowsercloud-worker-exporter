# ===== build ===== #
FROM node:16 as build

WORKDIR /app

# 拷贝 package 文件
COPY yarn.lock ./yarn.lock
COPY package.json ./package.json
COPY index.js ./index.js

ENV NODE_ENV production

# 安装依赖
RUN yarn install

CMD [ "npm", "start" ]
