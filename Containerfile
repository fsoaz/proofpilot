FROM mcr.microsoft.com/playwright:v1.64.1-noble
WORKDIR /proofpilot
COPY verifier/package.json verifier/package-lock.json ./
RUN npm ci --omit=dev
COPY verifier/browser.mjs shared/seed.mjs ./
USER pwuser
ENTRYPOINT ["node", "/proofpilot/browser.mjs"]
