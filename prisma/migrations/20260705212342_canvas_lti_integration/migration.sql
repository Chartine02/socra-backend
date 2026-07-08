-- CreateTable
CREATE TABLE "lti_platforms" (
    "id" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "deploymentId" TEXT,
    "authEndpoint" TEXT NOT NULL,
    "tokenEndpoint" TEXT NOT NULL,
    "jwksEndpoint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lti_platforms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lti_states" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "payload" JSONB,
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lti_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canvas_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canvasBaseUrl" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scopes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canvas_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canvas_courses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canvasCourseId" TEXT NOT NULL,
    "canvasBaseUrl" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "courseCode" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canvas_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canvas_content_items" (
    "id" TEXT NOT NULL,
    "canvasCourseId" TEXT NOT NULL,
    "canvasItemId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentUrl" TEXT,
    "htmlContent" TEXT,
    "textContent" TEXT,
    "fileSize" INTEGER,
    "lastModifiedAt" TIMESTAMP(3),
    "documentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canvas_content_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lti_platforms_issuer_key" ON "lti_platforms"("issuer");

-- CreateIndex
CREATE UNIQUE INDEX "lti_states_state_key" ON "lti_states"("state");

-- CreateIndex
CREATE UNIQUE INDEX "canvas_tokens_userId_canvasBaseUrl_key" ON "canvas_tokens"("userId", "canvasBaseUrl");

-- CreateIndex
CREATE UNIQUE INDEX "canvas_courses_userId_canvasCourseId_canvasBaseUrl_key" ON "canvas_courses"("userId", "canvasCourseId", "canvasBaseUrl");

-- CreateIndex
CREATE UNIQUE INDEX "canvas_content_items_canvasCourseId_canvasItemId_itemType_key" ON "canvas_content_items"("canvasCourseId", "canvasItemId", "itemType");

-- AddForeignKey
ALTER TABLE "canvas_tokens" ADD CONSTRAINT "canvas_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas_courses" ADD CONSTRAINT "canvas_courses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas_content_items" ADD CONSTRAINT "canvas_content_items_canvasCourseId_fkey" FOREIGN KEY ("canvasCourseId") REFERENCES "canvas_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas_content_items" ADD CONSTRAINT "canvas_content_items_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
