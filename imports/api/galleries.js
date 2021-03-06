import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import axios from 'axios'

import { initCollection } from './common.js'
import { GallerySearchResponses } from './gallerySearchResponses.js'
import { Photos } from './photos.js'

export const Galleries = initCollection('galleries')
const responseRegex = /jsonFlickrApi\((.+)\)/g

if (Meteor.isServer) {
  Meteor.publish('galleries', () => Galleries.find())

  Meteor.methods({
    async 'galleries.search'(galleryId) {
      if (!this.userId) { return 'not logged in' }

      const now = new Date()
      const gallery = Galleries.findOne(galleryId)
      const page = 2

      try {
        // https://www.flickr.com/services/api/flickr.photos.licenses.getInfo.html
        const response = await axios.get('https://www.flickr.com/services/rest/', {
          params: {
            method: 'flickr.photos.search',
            api_key: process.env.FLICKR_KEY,
            format: 'json',
            text: gallery.searchText,
            sort: 'relevance',
            privacy_filter: 1, // public only
            media: 'photos',
            license: '2,4,7,8,9,10',
            content_type: 1, // no screenshots
            extras: 'description,license,date_upload,date_taken,owner_name,icon_server,tags,geo,o_dims,path_alias,url_sq,url_t,url_s,url_q,url_m,url_n,url_z,url_c,url_l,url_o',
            per_page: 500,
            page
          }
        })

        const searchResult = response.data
        const matches = responseRegex.exec(searchResult)

        if (!matches) {
          console.log(searchResult)
          return
        }

        const responseData = JSON.parse(matches[1])

        GallerySearchResponses.upsert(
          {
            galleryId,
            page
          },
          {$set: {response: responseData, searchedAt: now}}
        )

        const photos = responseData.photos.photo
        photos.forEach((photo) => {
          flickrId = photo.id
          delete photo.id

          Photos.upsert(
            {galleryId, flickrId},
            {$set: {flickrData: photo, searchedAt: now}}
          )
        })
      } catch (error) {
        console.error(error)
      }
    }
  });
}
