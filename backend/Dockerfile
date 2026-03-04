# Use official Node image
FROM node:18

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all source code
COPY . .

# Expose backend port (if using 3000)
EXPOSE 3000

# Start app
CMD ["npm", "start"]