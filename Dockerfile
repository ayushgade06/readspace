# ReadSpace image: the Express API plus the built React frontend.
#
#   docker build -t readspace:1.0 .
#
# Three stages are used so that the final image contains only what is
# needed to run the application (no TypeScript compiler, no source code).

# ---- Stage 1: build the React frontend into static files ----
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: compile the TypeScript backend to JavaScript ----
FROM node:22-alpine AS backend-build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

# ---- Stage 3: the image that actually runs ----
FROM node:22-alpine
ENV NODE_ENV=production
ENV PORT=4000
WORKDIR /app/backend

# Install runtime dependencies only.
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Compiled backend, built frontend and the SQL scripts.
COPY --from=backend-build /app/backend/dist ./dist
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist
COPY database/ /app/database/

# Run as the unprivileged "node" user that ships with the base image.
USER node

# The application listens on port 4000 (see PORT above).
EXPOSE 4000

CMD ["node", "dist/server.js"]
