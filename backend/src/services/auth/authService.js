import bcrypt from "bcrypt";

import {
  findUserByIdentity
} from "../../repositories/auth/userRepository.js";

/**
 * Authenticate a user.
 *
 * This service contains authentication business logic.
 *
 * Repository:
 *   Database se user data laata hai.
 *
 * Service:
 *   User login kar sakta hai ya nahi decide karta hai.
 *
 * Controller:
 *   HTTP request/response handle karega.
 */
export const authenticateUser = async ({
  identity,
  password,
}) => {

  // ----------------------------------------------------------
  // 1. Find user from database
  // ----------------------------------------------------------

  const user = await findUserByIdentity(identity);

  // ----------------------------------------------------------
  // 2. User does not exist
  //
  // Security reason:
  // We should avoid telling the client whether the username,
  // email or phone actually exists.
  // ----------------------------------------------------------

  if (!user) {
    return {
      success: false,
      reason: "INVALID_CREDENTIALS",
    };
  }

  // ----------------------------------------------------------
  // 3. Check whether the account is active
  // ----------------------------------------------------------

  if (!user.is_active) {
    return {
      success: false,
      reason: "ACCOUNT_INACTIVE",
    };
  }

  // ----------------------------------------------------------
  // 4. Check whether login is enabled
  // ----------------------------------------------------------

  if (!user.is_login_enabled) {
    return {
      success: false,
      reason: "LOGIN_DISABLED",
    };
  }

  // ----------------------------------------------------------
  // 5. Check whether account is temporarily locked
  // ----------------------------------------------------------

  if (
    user.locked_until &&
    new Date(user.locked_until) > new Date()
  ) {
    return {
      success: false,
      reason: "ACCOUNT_LOCKED",
      lockedUntil: user.locked_until,
    };
  }

  // ----------------------------------------------------------
  // 6. Verify password
  //
  // password:
  //   Plain password received from login request.
  //
  // user.password_hash:
  //   bcrypt hash stored in master_user.
  //
  // IMPORTANT:
  // Plain password is NEVER stored in the database.
  // ----------------------------------------------------------

  const passwordMatched = await bcrypt.compare(
    password,
    user.password_hash
  );

  if (!passwordMatched) {
    return {
      success: false,
      reason: "INVALID_CREDENTIALS",
      userId: user.id,
    };
  }

  // ----------------------------------------------------------
  // 7. Authentication successful
  // ----------------------------------------------------------

  return {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      firstName: user.first_name,
      middleName: user.middle_name,
      lastName: user.last_name,
    },
  };
};