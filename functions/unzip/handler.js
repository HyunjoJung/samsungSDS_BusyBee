const AWS = require("aws-sdk");
const { simpleParser } = require("mailparser");
const AdmZip = require("adm-zip");
const path = require("path");

const s3 = new AWS.S3();
const sqs = new AWS.SQS();

module.exports.unzip = async (event) => {
  try {
    for (const record of event.Records) {
      const attachmentKeys = [];
      const message = JSON.parse(record.body);
      const key = message.key;
      const bucketName = "request-mail";
      const params = {
        Bucket: bucketName,
        Key: key,
      };
      const data = await s3.getObject(params).promise();
      const parsedEmail = await simpleParser(data.Body);

      for (const attachment of parsedEmail.attachments) {
        if (attachment.filename.endsWith(".zip")) {
          console.log(`Unzipping attachment: ${attachment.filename}`);
          await processZipFile(
            attachment.content,
            `${key.split("/").slice(1).join("/")}/${attachment.filename}`,
            attachmentKeys
          );
        } else if (isAllowedExtension(attachment.filename)) {
          const targetBucketName = "mails-to-files";
          const attachmentKey = `${key.split("/").slice(1).join("/")}/${
            attachment.filename
          }`;
          await s3
            .putObject({
              Bucket: targetBucketName,
              Key: attachmentKey,
              Body: attachment.content,
            })
            .promise();

          attachmentKeys.push(attachmentKey);
          console.log(
            `Attachment ${attachment.filename} saved to ${targetBucketName}/${attachmentKey}`
          );
        } else {
          console.log(
            `Skipping file: ${attachment.filename} (unsupported extension)`
          );
        }
      }

      // SQS 메시지 전송
      const sqsParams = {
        QueueUrl:
          "https://sqs.ap-northeast-2.amazonaws.com/481665114066/zip-mail-classification-trigger",
        MessageBody: JSON.stringify({
          key: key,
          sender: message.sender,
          receiver: message.receiver,
          subject: message.subject,
          email_content: message.email_content,
          received_date: message.received_date,
          attachments: attachmentKeys,
        }),
      };

      await sqs.sendMessage(sqsParams).promise();
      console.log("SQS message sent successfully:", sqsParams.MessageBody);
    }
  } catch (error) {
    console.error("Error processing SQS message:", error);
    throw new Error("Error processing SQS message");
  }
};

// ZIP 파일을 처리하고 모든 엔트리를 탐색하는 함수
const processZipFile = async (zipContent, basePath, attachmentKeys) => {
  const zip = new AdmZip(zipContent);
  const zipEntries = zip.getEntries();

  for (const entry of zipEntries) {
    const entryPath = path.join(
      basePath,
      entry.entryName.split("/").slice(1).join("/")
    );

    if (entry.isDirectory) {
      console.log(`Directory: ${entry.entryName}`);
    } else {
      console.log(`Processing file: ${entry.entryName}`);
      if (entry.entryName.endsWith(".zip")) {
        console.log(`Found nested ZIP file: ${entry.entryName}`);
        const nestedZipContent = entry.getData();
        await processZipFile(nestedZipContent, entryPath, attachmentKeys);
      } else if (isAllowedExtension(entry.entryName)) {
        await s3
          .putObject({
            Bucket: "mails-to-files",
            Key: entryPath,
            Body: entry.getData(),
          })
          .promise();

        attachmentKeys.push(entryPath);
        console.log(`File ${entry.entryName} saved to S3`);
      } else {
        console.log(
          `Skipping file: ${entry.entryName} (unsupported extension)`
        );
      }
    }
  }
};

// 지원되는 확장자를 확인하는 함수
const isAllowedExtension = (filename) => {
  const allowedExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".pdf",
    ".doc",
    ".docx",
    ".hwp",
    ".xls",
    ".xlsx",
    ".csv",
    ".txt",
  ];
  const fileExtension = path.extname(filename).toLowerCase();
  return allowedExtensions.includes(fileExtension);
};
