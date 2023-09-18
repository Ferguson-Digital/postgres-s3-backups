import { exec } from "child_process";
import { PutObjectCommand, S3Client, S3ClientConfig } from "@aws-sdk/client-s3";
import { createReadStream, unlink } from "fs";
import { stat, mkdir } from 'fs/promises'

import { env } from "./env";

const uploadToS3 = async ({ name, prefix, path }: { name: string, prefix: string, path: string }) => {
  console.log("Uploading backup to S3...");

  const bucket = env.AWS_S3_BUCKET;

  const clientOptions: S3ClientConfig = {
    region: env.AWS_S3_REGION,
  }

  if (env.AWS_S3_ENDPOINT) {
    console.log(`Using custom endpoint: ${env.AWS_S3_ENDPOINT}`)
    clientOptions['endpoint'] = env.AWS_S3_ENDPOINT;
  }

  const client = new S3Client(clientOptions);

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: `${prefix}/${name}`,
      Body: createReadStream(path),
    })
  )

  console.log("Backup uploaded to S3...");
}

const dumpToFile = async (path: string, url: string) => {
  console.log("Dumping DB to file...");

  // check if directory exists
  const dir = path.split('/').slice(0, -1).join('/');
  const dirExists = await stat(dir).then(() => true).catch(() => false);

  if (!dirExists) {
    console.log(`Creating directory ${dir}...`)
    await mkdir(dir, { recursive: true });
  }

  await new Promise((resolve, reject) => {
    exec(
      `pg_dump ${url} -F t | gzip > ${path}`,
      (error, stdout, stderr) => {
        if (error) {
          reject({ error: JSON.stringify(error), stderr });
          return;
        }

        resolve(undefined);
      }
    );
  });

  console.log("DB dumped to file...");
}

const deleteFile = async (path: string) => {
  console.log("Deleting file...");
  await new Promise((resolve, reject) => {
    unlink(path, (err) => {
      reject({ error: JSON.stringify(err) });
      return;
    });
    resolve(undefined);
  })
}

export const backup = async () => {
  console.log("Initiating DB backup...")

  await Promise.all(
    env.BACKUP_DATABASE_URLS_CONFIG.map(async database => {
      const { url, name: label } = database;
      console.log(`Backing up ${label}...`)

      let date = new Date().toISOString()
      const timestamp = date.replace(/[:.]+/g, '-')
      const filename = `backup-${timestamp}.tar.gz`
      const filepath = `/tmp/${label}/${filename}`

      await dumpToFile(filepath, url)
      await uploadToS3({ name: filename, prefix: label, path: filepath })
      await deleteFile(filepath)

      console.log(`Backup of ${database.name} complete...`)
    })
  );

  console.log("DB backup complete...")
}
