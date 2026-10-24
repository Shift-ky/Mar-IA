declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
declare namespace Cloudflare {
 interface Env {
  WA_APP_SECRET?:string; WA_VERIFY_TOKEN?:string; WA_ACCESS_TOKEN?:string; WA_PHONE_NUMBER_ID?:string; WA_GRAPH_VERSION?:string; WA_JOB_SECRET?:string;
  RECEIPT_EXTRACTOR_URL?:string; RECEIPT_EXTRACTOR_TOKEN?:string;
 }
}
