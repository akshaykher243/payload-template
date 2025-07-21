import type * as AWS from '@aws-sdk/client-s3'
import type { StaticHandler } from '@payloadcms/plugin-cloud-storage/types'
import type { CollectionConfig } from 'payload'

import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getFilePrefix } from '@payloadcms/plugin-cloud-storage/utilities'
import path from 'path'

interface Args {
  bucket: string
  collection: CollectionConfig
  getStorageClient: () => AWS.S3
  signedDownloads: SignedDownloadsConfig | false
}

export type SignedDownloadsConfig = {
  expiresIn?: number
  shouldUseSignedURL?: (args: {
    collection: CollectionConfig
    filename: string
    req: any
  }) => boolean | Promise<boolean>
}

// Type check for Node.js readable stream
const isNodeReadableStream = (body: any): body is NodeJS.ReadableStream => {
  return (
    body &&
    typeof body === 'object' &&
    typeof (body as any).pipe === 'function' &&
    'destroy' in body &&
    typeof (body as any).destroy === 'function'
  )
}

const destroyStream = (object: AWS.GetObjectOutput | undefined) => {
  if (object?.Body && isNodeReadableStream(object.Body)) {
    ;(object.Body as any).destroy()
  }
}

// Convert a stream into a promise that resolves with a Buffer
const streamToBuffer = async (readableStream: any) => {
  const chunks = []
  for await (const chunk of readableStream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

export const getHandler = ({
  bucket,
  collection,
  getStorageClient,
  signedDownloads,
}: Args): StaticHandler => {
  return async (req, { headers: incomingHeaders, params: { clientUploadContext, filename } }) => {
    let object: AWS.GetObjectOutput | undefined = undefined
    try {
      console.log(`[R2 StaticHandler] Serving file: ${filename}`)
      const prefix = await getFilePrefix({ clientUploadContext, collection, filename, req })

      const key = path.posix.join(prefix, filename)
      console.log(`[R2 StaticHandler] R2 key: ${key}`)

      if (signedDownloads && !clientUploadContext) {
        let useSignedURL = true
        if (
          typeof signedDownloads === 'object' &&
          typeof signedDownloads.shouldUseSignedURL === 'function'
        ) {
          useSignedURL = await signedDownloads.shouldUseSignedURL({ collection, filename, req })
        }

        if (useSignedURL) {
          const command = new GetObjectCommand({ Bucket: bucket, Key: key })
          const signedUrl = await getSignedUrl(
            getStorageClient(),
            command,
            typeof signedDownloads === 'object' ? signedDownloads : { expiresIn: 7200 },
          )
          return Response.redirect(signedUrl, 302)
        }
      }

      console.log(`[R2 StaticHandler] Fetching from bucket: ${bucket}, key: ${key}`)
      object = await getStorageClient().getObject({
        Bucket: bucket,
        Key: key,
      })

      if (!object.Body) {
        console.log(`[R2 StaticHandler] File not found: ${key}`)
        return new Response(null, { status: 404, statusText: 'Not Found' })
      }

      let headers = new Headers(incomingHeaders)

      headers.append('Content-Length', String(object.ContentLength))
      headers.append('Content-Type', String(object.ContentType))
      headers.append('Accept-Ranges', String(object.AcceptRanges))
      headers.append('ETag', String(object.ETag))

      const etagFromHeaders = req.headers.get('etag') || req.headers.get('if-none-match')
      const objectEtag = object.ETag

      if (
        collection.upload &&
        typeof collection.upload === 'object' &&
        typeof collection.upload.modifyResponseHeaders === 'function'
      ) {
        headers = collection.upload.modifyResponseHeaders({ headers }) || headers
      }

      if (etagFromHeaders && etagFromHeaders === objectEtag) {
        return new Response(null, {
          headers,
          status: 304,
        })
      }

      // On error, manually destroy stream to close socket
      if (object.Body && isNodeReadableStream(object.Body)) {
        const stream = object.Body as any
        stream.on('error', (err: any) => {
          req.payload.logger.error({
            err,
            key,
            msg: 'Error streaming R2 object, destroying stream',
          })
          stream.destroy()
        })
      }

      const bodyBuffer = await streamToBuffer(object.Body)
      console.log(`[R2 StaticHandler] Successfully served file: ${filename}, size: ${bodyBuffer.length}`)

      return new Response(bodyBuffer, {
        headers,
        status: 200,
      })
    } catch (err: unknown) {
      destroyStream(object)
      console.error(`[R2 StaticHandler] Error serving file ${filename}:`, err)
      req.payload.logger.error({ err, msg: 'Error in R2 static handler' })
      return new Response('Internal Server Error', { status: 500 })
    }
  }
}
