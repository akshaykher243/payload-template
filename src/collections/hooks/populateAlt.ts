import path from 'path'
import { CollectionBeforeChangeHook } from 'payload'

export const populateAlt: CollectionBeforeChangeHook = async ({ data, req }) => {
  if (!data.title && req.file) {
    const fileName = req.file.name
    const fileNameWithoutExt = path.parse(fileName).name
    data.title = fileNameWithoutExt
  }
  return data
}
