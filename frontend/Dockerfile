FROM node:20-alpine

WORKDIR /app

RUN npm install -g pnpm@10.13.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# La URL de la API se hornea en el bundle en tiempo de build
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY . .
RUN pnpm build

CMD ["pnpm", "start"]
