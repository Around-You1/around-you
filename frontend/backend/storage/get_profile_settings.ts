// Mirrors the Go appdb.ProfileSettings JSON shape. Named to match the original
// import path `~backend/storage/get_profile_settings`.

export interface ProfileSettings {
  bookingsEmail?: string;
  bookingsContactNumber?: string;
  socialsWebsite?: string;
  socialsInstagram?: string;
  socialsTwitter?: string;
  socialsYoutube?: string;
  socialsTiktok?: string;
}
