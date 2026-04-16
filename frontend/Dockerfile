FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better layer caching
COPY package.json yarn.lock* ./
# --ignore-optional handles private/unreachable optional packages like @emergentbase/visual-edits
RUN yarn install --ignore-optional || yarn install

COPY . .

EXPOSE 3000

CMD ["yarn", "start"]
