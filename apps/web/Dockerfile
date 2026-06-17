FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

FROM base AS builder
ARG CACHE_BUST=1
RUN echo "cache bust: $CACHE_BUST"
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV JWT_SECRET=build_placeholder
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost/placeholder
ENV NEXT_PUBLIC_APP_URL=https://taptarea.com
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_51TWf7zGua4dfcnJ9ZIIVfje6IJGveoQZthhDr54jxVYLwGM5xTbdhAC4hY2Z0SiOHXPRJwmAPOpFXom7YZIRsXZd000tuovwCs
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyCqDnoc2Ga5hTkSXd_xHsrk2Wf7p2bo3eI
RUN npx prisma generate
RUN npm run build

FROM base AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
