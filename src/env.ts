import { envsafe, str, bool, json, InvalidEnvError, makeValidator } from "envsafe";

const database_config_validator = makeValidator<{ url: string, name: string }[]>(value => {
  try {
    if (typeof value !== 'string') {
      throw new InvalidEnvError(`Expected ${value} to be a JSON array of objects containing a url and a name`);
    }

    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      throw new InvalidEnvError(`Expected ${value} to be a JSON array of objects containing a url and a name`);
    }

    parsed.forEach((item: any, index) => {
      if (!item.url) {
        throw new InvalidEnvError(`Expected ${value} to have url property at index ${index}`);
      }

      if (!item.name) {
        throw new InvalidEnvError(`Expected ${value} to have name property at index ${index}`);
      }
    })

    return parsed as { url: string, name: string }[];
  } catch (e) {
    throw new InvalidEnvError(`Expected ${value} to be a JSON array of objects containing a url and a name`);
  }
})

export const env = envsafe({
  AWS_ACCESS_KEY_ID: str(),
  AWS_SECRET_ACCESS_KEY: str(),
  AWS_S3_BUCKET: str(),
  AWS_S3_REGION: str(),
  BACKUP_DATABASE_URLS_CONFIG: database_config_validator({
    desc: 'JSON Array of objects containing a database url and a name for the backup',
  }),
  BACKUP_CRON_SCHEDULE: str({
    desc: 'The cron schedule to run the backup on.',
    default: '0 5 * * *',
    allowEmpty: true
  }),
  AWS_S3_ENDPOINT: str({
    desc: 'The S3 custom endpoint you want to use.',
    default: '',
    allowEmpty: true,
  }),
  RUN_ON_STARTUP: bool({
    desc: 'Run a backup on startup of this application',
    default: false,
    allowEmpty: true,
  })
})