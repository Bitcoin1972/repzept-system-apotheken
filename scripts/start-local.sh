#!/bin/sh

set -eu

if [ ! -f ".env" ]; then
  echo "Fehlende .env. Bitte .env.example nach .env kopieren und DATABASE_URL setzen."
  exit 1
fi

echo "Installiere Abhaengigkeiten, falls noetig..."
npm install

echo "Generiere Prisma Client..."
npm run prisma:generate

echo "Starte Next.js Dev Server..."
npm run dev
