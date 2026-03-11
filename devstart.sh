#!/usr/bin/env bash

set -e

if [ -f .env ]; then
  rm .env
fi

cp .env.example .env
docker compose up -d postgres redis
npm run prisma:push
npm run prisma:seed
npm run dev
