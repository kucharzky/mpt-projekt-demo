FROM restic/restic:0.19.1 AS restic
FROM postgres:18.6-bookworm
COPY --from=restic /usr/bin/restic /usr/local/bin/restic
COPY --chmod=755 deploy/backup.sh /usr/local/bin/smartuni-backup
USER postgres
ENTRYPOINT ["/usr/local/bin/smartuni-backup"]
