-- Align client.applicant_cognito_sub collation with user.cognito_sub (utf8mb4_0900_ai_ci)
ALTER TABLE `client`
  MODIFY `applicant_cognito_sub` VARCHAR(128) COLLATE utf8mb4_0900_ai_ci NULL;
