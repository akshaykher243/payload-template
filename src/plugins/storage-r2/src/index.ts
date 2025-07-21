import type {
  Adapter,
  ClientUploadsConfig,
  PluginOptions as CloudStoragePluginOptions,
  CollectionOptions,
  GeneratedAdapter,
} from '@payloadcms/plugin-cloud-storage/types'
import type { NodeHttpHandlerOptions } from '@smithy/node-http-handler'
import type { Config, Plugin, UploadCollectionSlug } from 'payload'

import * as AWS from '@aws-sdk/client-s3'
import { cloudStoragePlugin } from '@payloadcms/plugin-cloud-storage'
import { initClientUploads } from '@payloadcms/plugin-cloud-storage/utilities'

import type { SignedDownloadsConfig } from './staticHandler.js'

import { getGenerateSignedURLHandler } from './generateSignedURL.js'
import { getGenerateURL } from './generateURL.js'
import { getHandleDelete } from './handleDelete.js'
import { getHandleUpload } from './handleUpload.js'
import { getHandler } from './staticHandler.js'

export interface R2CollectionOptions extends CollectionOptions {
  signedDownloads?: SignedDownloadsConfig
}

export type R2StorageOptions = {
  /**
   * Access control list for uploaded files.
   */
  acl?: 'private' | 'public-read'

  /**
   * R2 bucket name to upload files to.
   */
  bucket: string

  /**
   * Use client uploads for direct uploads to R2
   */
  clientUploads?: ClientUploadsConfig | boolean

  /**
   * Collection-specific options
   */
  collections: {
    [collectionSlug: string]: R2CollectionOptions | true
  }

  /**
   * R2 configuration object
   */
  config?: AWS.S3ClientConfig

  /**
   * Whether or not to disable local storage for all collections
   */
  disableLocalStorage?: boolean

  /**
   * Whether or not to enable the plugin
   *
   * Default: true
   */
  enabled?: boolean

  /**
   * Use pre-signed URLs for files downloading. Can be overriden per-collection.
   */
  signedDownloads?: SignedDownloadsConfig
}

type R2StoragePlugin = (storageR2Args: R2StorageOptions) => Plugin

let storageClient: AWS.S3 | null = null

const defaultRequestHandlerOpts: NodeHttpHandlerOptions = {
  httpAgent: {
    keepAlive: true,
    maxSockets: 100,
  },
  httpsAgent: {
    keepAlive: true,
    maxSockets: 100,
  },
}

export const r2Storage: R2StoragePlugin =
  (r2StorageOptions: R2StorageOptions) =>
  (incomingConfig: Config): Config => {
    const getStorageClient: () => AWS.S3 = () => {
      if (storageClient) {
        return storageClient
      }

      storageClient = new AWS.S3({
        requestHandler: defaultRequestHandlerOpts,
        ...r2StorageOptions.config,
      })
      return storageClient
    }

    const isPluginDisabled = r2StorageOptions.enabled === false

    initClientUploads({
      clientHandler: './plugins/storage-r2/src/client#R2ClientUploadHandler',
      collections: r2StorageOptions.collections,
      config: incomingConfig,
      enabled: !isPluginDisabled && Boolean(r2StorageOptions.clientUploads),
      serverHandler: getGenerateSignedURLHandler({
        access:
          typeof r2StorageOptions.clientUploads === 'object'
            ? r2StorageOptions.clientUploads.access
            : undefined,
        acl: r2StorageOptions.acl,
        bucket: r2StorageOptions.bucket,
        collections: r2StorageOptions.collections,
        getStorageClient,
      }),
      serverHandlerPath: '/storage-r2-generate-signed-url',
    })

    if (isPluginDisabled) {
      return incomingConfig
    }

    const adapter = r2StorageInternal(getStorageClient, r2StorageOptions)

    // Add adapter to each collection option object
    const collectionsWithAdapter: CloudStoragePluginOptions['collections'] = Object.entries(
      r2StorageOptions.collections,
    ).reduce(
      (acc, [slug, collOptions]) => ({
        ...acc,
        [slug]: {
          ...(collOptions === true ? {} : collOptions),
          adapter,
        },
      }),
      {} as Record<string, CollectionOptions>,
    )

    // Set disableLocalStorage: true for collections specified in the plugin options
    const config = {
      ...incomingConfig,
      collections: (incomingConfig.collections || []).map((collection) => {
        if (!(collection.slug in collectionsWithAdapter)) {
          return collection
        }

        return {
          ...collection,
          upload: {
            ...(typeof collection.upload === 'object' ? collection.upload : {}),
            disableLocalStorage: true,
          },
        }
      }),
    }

    return cloudStoragePlugin({
      collections: collectionsWithAdapter,
    })(config)
  }

function r2StorageInternal(
  getStorageClient: () => AWS.S3,
  {
    acl,
    bucket,
    clientUploads,
    collections,
    config = {},
    signedDownloads: topLevelSignedDownloads,
  }: R2StorageOptions,
): Adapter {
  return ({ collection, prefix }): GeneratedAdapter => {
    const collectionStorageConfig = collections[collection.slug]

    let signedDownloads: null | SignedDownloadsConfig | false =
      typeof collectionStorageConfig === 'object'
        ? (collectionStorageConfig.signedDownloads ?? null)
        : null

    if (signedDownloads === null) {
      signedDownloads = topLevelSignedDownloads ?? null
    }

    return {
      name: 'r2',
      clientUploads,
      generateURL: getGenerateURL({ bucket, config }),
      handleDelete: getHandleDelete({ bucket, getStorageClient }),
      handleUpload: getHandleUpload({
        acl,
        bucket,
        collection,
        getStorageClient,
        prefix,
      }),
      staticHandler: getHandler({
        bucket,
        collection,
        getStorageClient,
        signedDownloads: signedDownloads || false,
      }),
    }
  }
}
