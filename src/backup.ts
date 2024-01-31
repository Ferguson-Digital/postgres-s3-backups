import { S3Client, S3ClientConfig } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { exec, execSync } from "child_process";
import { filesize } from "filesize";
import { createReadStream, statSync, unlink } from "fs";
import { mkdir, stat } from 'fs/promises';
import path from "path";
import { env } from "./env";

const uploadToS3 = async ({ name, prefix, filePath: path }: { name: string, prefix: string, filePath: string }) => {
  console.log("Uploading backup to S3...");

  const bucket = env.AWS_S3_BUCKET;

  const clientOptions: S3ClientConfig = {
    region: env.AWS_S3_REGION
  }

  if (env.AWS_S3_ENDPOINT) {
    console.log(`Using custom endpoint: ${env.AWS_S3_ENDPOINT}`)
    clientOptions['endpoint'] = env.AWS_S3_ENDPOINT;
  }

  const client = new S3Client(clientOptions);

  await new Upload({
    client,
    params: {
      Bucket: bucket,
      Key: `${prefix}/${name}`,
      Body: createReadStream(path),
    },
  }).done();

  console.log("Backup uploaded to S3...");
}

const dumpToFile = async (filePath: string, url: string) => {
  console.log("Dumping DB to file...");

  // check if directory exists
  const dir = filePath.split('/').slice(0, -1).join('/');
  const dirExists = await stat(dir).then(() => true).catch(() => false);

  if (!dirExists) {
    console.log(`Creating directory ${dir}...`)
    await mkdir(dir, { recursive: true });
  }

  await new Promise((resolve, reject) => {
    exec(`pg_dump ${url} --format=tar | gzip > ${filePath}`, (error, stdout, stderr) => {
      if (error) {
        reject({ error: error, stderr: stderr.trimEnd() });
        return;
      }

      // check if archive is valid and contains data
      const isValidArchive = (execSync(`gzip -cd ${filePath} | head -c1`).length == 1) ? true : false;
      if (isValidArchive == false) {
        reject({ error: "Backup archive file is invalid or empty; check for errors above" });
        return;
      }

      // not all text in stderr will be a critical error, print the error / warning
      if (stderr != "") {
        console.log({ stderr: stderr.trimEnd() });
      }

      console.log("Backup archive file is valid");
      console.log("Backup filesize:", filesize(statSync(filePath).size));

      // if stderr contains text, let the user know that it was potently just a warning message
      if (stderr != "") {
        console.log(`Potential warnings detected; Please ensure the backup file "${path.basename(filePath)}" contains all needed data`);
      }

      resolve(undefined);
    });
  });

  console.log("DB dumped to file...");
}

const deleteFile = async (path: string) => {
  console.log("Deleting file...");
  await new Promise((resolve, reject) => {
    unlink(path, (err) => {
      reject({ error: err });
      return;
    });
    resolve(undefined);
  });
}

export const backup = async () => {
  console.log("Initiating DB backup...");

  await Promise.all(
    env.BACKUP_DATABASE_URLS_CONFIG.map(async database => {
      const { url, name: label } = database;
      console.log(`Backing up ${label}...`)

      const date = new Date().toISOString()
      const timestamp = date.replace(/[:.]+/g, '-')
      const filename = `backup-${timestamp}.tar.gz`
      const filepath = `/tmp/${label}/${filename}`

      await dumpToFile(filepath, url)
      await uploadToS3({ name: filename, prefix: label, filePath: filepath })
      await deleteFile(filepath)

      console.log(`Backup of ${database.name} complete...`)
    })
  );

  console.log("DB backup complete...");
}
