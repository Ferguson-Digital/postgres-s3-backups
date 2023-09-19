# Postgres S3 backups

A simple NodeJS application to backup your PostgreSQL database to S3 via a cron.

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template/I4zGrH)

## Restore from Backup
1. Download the backup from GCP
    1. Go to buckets https://console.cloud.google.com/storage/browser
    2. Open the ferg-railway-db-backup bucket
    3. Select the folder named after the database you want to restore and download one of the backup files
2. Decompress the file
    ```bash
     gunzip <dump_archive_file>
    ```
3. Clear out the old records in the database if you want a clean refresh
    1. Connect To Database
        ```bash
        PGPASSWORD=<password> psql -U <username> -h <host> -p <port> -d <db_name>
        ```
    2. Truncate all tables you want to clear
        ```sql
        BEGIN;
        TRUNCATE table_1;
        TRUNCATE table_2;
        ...
        COMMIT;
        ```
5. Run the restore command (connection details are in railway)
  ```bash
    PGPASSWORD=<password> pg_restore -U <username> -h <host> -p <port> -W -F t -d <db_name> <dump_file_name>
  ```
  If you are using Prisma ORM, your command might finish with a warning. Don't fret, your data would import as normal.

## References
https://blog.railway.app/p/postgre-backup
