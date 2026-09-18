export interface Coords {
  lat: number
  lng: number
  accuracy: number
}

export class GeoError extends Error {}

/**
 * Wraps the Geolocation API in a promise and, more importantly, translates its
 * failure modes into something an admin standing on a street can act on.
 *
 * Browsers only expose geolocation on a secure origin, so over plain HTTP the
 * call fails no matter what the user taps -- worth saying outright rather than
 * showing a generic "permission denied".
 */
export function getCurrentPosition(timeoutMs = 12000): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new GeoError('This browser cannot share a location. Enter the meeting point instead.'))
      return
    }
    if (!window.isSecureContext) {
      reject(
        new GeoError(
          'Location needs a secure (https) connection. Open the app over https, or enter the meeting point instead.',
        ),
      )
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            reject(
              new GeoError(
                'Location permission was denied. Allow it in your browser settings, or enter the meeting point instead.',
              ),
            )
            break
          case err.POSITION_UNAVAILABLE:
            reject(new GeoError('Your position is not available right now. Try again or type it in.'))
            break
          case err.TIMEOUT:
            reject(new GeoError('Getting your position took too long. Try again or type it in.'))
            break
          default:
            reject(new GeoError('Could not get your position. Enter the meeting point instead.'))
        }
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    )
  })
}
