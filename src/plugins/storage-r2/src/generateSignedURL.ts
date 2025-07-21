import type { ClientUploadsAccess } from '@payloadcms/plugin-cloud-storage/types'
import type { PayloadHandler } from 'payload'

import * as AWS from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import path from 'path'
import { APIError, Forbidden } from 'payload'

import type { R2StorageOptions } from './index.js'

interface Args {
  access?: ClientUploadsAccess
  acl?: 'private' | 'public-read'
  bucket: string
  collections: R2StorageOptions['collections']
  getStorageClient: () => AWS.S3
}

const defaultAccess: Args['access'] = ({ req }) => !!req.user

export const getGenerateSignedURLHandler = ({
  access = defaultAccess,
  acl,
  bucket,
  collections,
  getStorageClient,
}: Args): PayloadHandler => {
  return async (req) => {
    if (!req.json) {
      throw new APIError('Content-Type expected to be application/json', 400)
    }

    const { collectionSlug, filename, mimeType } = (await req.json()) as {
      collectionSlug: string
      filename: string
      mimeType: string
    }

    const collectionR2Config = collections[collectionSlug]
    if (!collectionR2Config) {
      throw new APIError(`Collection ${collectionSlug} was not found in R2 options`)
    }

    const hasAccess = await access({ collectionSlug: collectionSlug as any, req })
    if (!hasAccess) {
      throw new Forbidden()
    }

    const collectionPrefix =
      typeof collectionR2Config === 'object' && 'prefix' in collectionR2Config
        ? collectionR2Config.prefix
        : ''

    const prefix = collectionPrefix || ''

    const command = new AWS.PutObjectCommand({
      ACL: acl,
      Bucket: bucket,
      ContentType: mimeType,
      Key: path.posix.join(prefix, filename),
    })

    const url = await getSignedUrl(getStorageClient(), command, { expiresIn: 3600 })

    return Response.json({ url })
  }
}
