/**
 * ============================================================
 * Laundry ERP - User Repository
 * ============================================================
 *
 * File:
 *   src/repositories/auth/userRepository.js
 *
 * Purpose:
 *   master_user table se related database operations handle
 *   karna.
 *
 * Responsibilities:
 *   1. Email/mobile se user lookup.
 *   2. Registration ke liye email duplicate check.
 *   3. Naya user create karna.
 *   4. Failed login attempts manage karna.
 *   5. Account lock/unlock state manage karna.
 *   6. Last login timestamp update karna.
 *   7. Google authentication ke liye user lookup.
 *
 * Business Rules:
 *   - Email UNIQUE hai.
 *   - Phone number duplicate ho sakta hai.
 *   - Username supported nahi hai.
 *   - Soft-deleted users normal lookup mein include nahi honge.
 *   - Password hashing service layer mein hogi.
 *
 * IMPORTANT:
 *   Passwords ko plain text mein database mein store mat karna.
 * ============================================================
 */

import { createDatabaseConnection } from "../../config/databaseConnection.js";


/**
 * ============================================================
 * Find User By Identity
 * ============================================================
 *
 * Purpose:
 *   Email ya phone number se user find karna.
 *
 * IMPORTANT:
 *   Email unique hai, lekin phone duplicate ho sakta hai.
 *   Isliye phone identity se multiple users mil sakte hain.
 *
 * Is function ka use tabhi karo jab identity email ho,
 * ya phone lookup se pehle uniqueness confirm ki gayi ho.
 *
 * @param {string} identity
 * @returns {Promise<object|null>}
 */
export const findUserByIdentity = async (identity) => {
  const connection = await createDatabaseConnection("laundry_core");

  try {
    const [rows] = await connection.execute(
      `
        SELECT
          id,
          email,
          phone,
          first_name,
          middle_name,
          last_name,
          password_hash,
          is_login_enabled,
          last_login_at,
          failed_login_attempts,
          locked_until,
          is_active,
          created_at,
          updated_at,
          deleted_at
        FROM master_user
        WHERE
          (
            email = ?
            OR phone = ?
          )
          AND deleted_at IS NULL
        LIMIT 2
      `,
      [identity, identity]
    );

    /*
     * Email unique hone ki wajah se email se maximum
     * ek user milega.
     *
     * Phone duplicate hone par multiple rows aa sakti hain.
     * Caller ko ambiguity handle karni chahiye.
     */
    if (rows.length > 1) {
      return {
        multipleMatches: true,
        users: rows.map((user) => ({
          id: user.id,
          email: user.email,
          phone: user.phone,
        })),
      };
    }

    return rows[0] || null;
  } finally {
    await connection.end();
  }
};




/**
 * ============================================================
 * Find User By ID
 * ============================================================
 *
 * Purpose:
 * --------
 * Fetch a user using the unique user ID.
 *
 * Used by:
 * --------
 * Authentication middleware.
 *
 * Security:
 * ---------
 * - Deleted users are excluded.
 * - Password hashes are not returned.
 * - Only the fields required for authentication are selected.
 *
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
export const findUserById = async (userId) => {
    const connection = await createDatabaseConnection("laundry_core");

    try {
        const [rows] = await connection.execute(
            `
            SELECT
                id,
                email,
                phone,
                first_name,
                middle_name,
                last_name,
                is_active,
                is_login_enabled
            FROM master_user
            WHERE id = ?
              AND deleted_at IS NULL
            LIMIT 1
            `,
            [userId]
        );

        return rows[0] || null;

    } finally {
        await connection.end();
    }
};





/**
 * ============================================================
 * Find User By Email
 * ============================================================
 *
 * Purpose:
 *   Registration se pehle email duplicate check karna.
 *
 * @param {string} email
 * @returns {Promise<object|null>}
 */
/**
 * ============================================================
 * Find User By Email
 * ============================================================
 *
 * Purpose:
 *   Registration ke time email duplicate check karna.
 *
 * Transaction connection diya ho to usi connection ka use
 * hoga; warna repository apna connection open karegi.
 *
 * @param {string} email
 * @param {object|null} transactionConnection
 * @returns {Promise<object|null>}
 */
export const findUserByEmail = async (
  email,
  transactionConnection = null,
) => {
  // Reuse the active transaction connection when provided.
  const connection =
    transactionConnection ||
    await createDatabaseConnection("laundry_core");

  try {
    const [rows] = await connection.execute(
      `
        SELECT
          id,
          email
        FROM master_user
        WHERE email = ?
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [email],
    );

    return rows[0] || null;
  } finally {
    // Never close a connection owned by the transaction.
    if (!transactionConnection) {
      await connection.end();
    }
  }
};


/**
 * ============================================================
 * Find Users By Phone
 * ============================================================
 *
 * Purpose:
 *   Duplicate mobile number se linked users find karna.
 *
 * Rules:
 *   - Multiple users mil sakte hain.
 *   - Sirf active, non-deleted records nahi, balki
 *     sabhi non-deleted matching users return honge.
 *   - Password hash return nahi kiya jayega.
 *
 * Security:
 *   Is function ka result sirf account-selection ke liye hai.
 *   Isse authentication successful nahi mani jayegi.
 *
 * @param {string} phone
 * @returns {Promise<Array<object>>}
 */
export const findUsersByPhone = async (phone) => {
  const connection = await createDatabaseConnection("laundry_core");

  try {
    const [rows] = await connection.execute(
      `
        SELECT
          id,
          email,
          phone,
          first_name,
          middle_name,
          last_name,
          is_active,
          is_login_enabled
        FROM master_user
        WHERE phone = ?
          AND deleted_at IS NULL
        ORDER BY created_at ASC
      `,
      [phone]
    );

    return rows;
  } finally {
    await connection.end();
  }
};



/**
 * ============================================================
 * Create User
 * ============================================================
 *
 * Purpose:
 *   Transaction ke andar naya user create karna.
 *
 * IMPORTANT:
 *   - Connection caller provide karega.
 *   - Password pehle se bcrypt-hashed hona chahiye.
 *   - Is function mein separate connection open nahi hota.
 *   - Email uniqueness database constraint enforce karega.
 *   - Phone duplicate allowed hai.
 *
 * @param {object} params
 * @returns {Promise<object>}
 */
export const createUser = async ({
  connection,
  id,
  email,
  phone = null,
  firstName,
  middleName = null,
  lastName,
  passwordHash,
}) => {
  if (!connection) {
    throw new Error("Database transaction connection is required.");
  }

  const [result] = await connection.execute(
    `
      INSERT INTO master_user (
        id,
        email,
        phone,
        first_name,
        middle_name,
        last_name,
        password_hash,
        created_by,
        updated_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      email,
      phone,
      firstName,
      middleName,
      lastName,
      passwordHash,

      // Self-registration tracking.
      id,
      id,
    ]
  );

  return {
    id,
    email,
    phone,
    firstName,
    middleName,
    lastName,
    affectedRows: result.affectedRows,
  };
};


/**
 * ============================================================
 * Increment Failed Login Attempts
 * ============================================================
 *
 * @param {string} userId
 */
export const incrementFailedLoginAttempts = async (userId) => {
  const connection = await createDatabaseConnection("laundry_core");

  try {
    await connection.execute(
      `
        UPDATE master_user
        SET failed_login_attempts = failed_login_attempts + 1
        WHERE id = ?
          AND deleted_at IS NULL
      `,
      [userId]
    );
  } finally {
    await connection.end();
  }
};


/**
 * ============================================================
 * Lock User Account
 * ============================================================
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {Date} params.lockedUntil
 */
export const lockUserAccount = async ({
  userId,
  lockedUntil,
}) => {
  const connection = await createDatabaseConnection("laundry_core");

  try {
    await connection.execute(
      `
        UPDATE master_user
        SET locked_until = ?
        WHERE id = ?
          AND deleted_at IS NULL
      `,
      [lockedUntil, userId]
    );
  } finally {
    await connection.end();
  }
};


/**
 * ============================================================
 * Reset Failed Login Attempts
 * ============================================================
 *
 * Successful authentication ke baad failed attempts reset
 * karna aur expired lock clear karna.
 *
 * @param {string} userId
 */
export const resetFailedLoginAttempts = async (userId) => {
  const connection = await createDatabaseConnection("laundry_core");

  try {
    await connection.execute(
      `
        UPDATE master_user
        SET
          failed_login_attempts = 0,
          locked_until = NULL
        WHERE id = ?
          AND deleted_at IS NULL
      `,
      [userId]
    );
  } finally {
    await connection.end();
  }
};


/**
 * ============================================================
 * Update Last Login
 * ============================================================
 *
 * @param {string} userId
 */
export const updateLastLogin = async (userId) => {
  const connection = await createDatabaseConnection("laundry_core");

  try {
    await connection.execute(
      `
        UPDATE master_user
        SET last_login_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND deleted_at IS NULL
      `,
      [userId]
    );
  } finally {
    await connection.end();
  }
};


/**
 * ============================================================
 * Find Active User By Email
 * ============================================================
 *
 * Purpose:
 *   Google authentication aur account-linking logic ke liye
 *   active user find karna.
 *
 * IMPORTANT:
 *   Matching email ke basis par Google account automatically
 *   link nahi karna chahiye.
 *
 * @param {string} email
 * @returns {Promise<object|null>}
 */
export const findActiveUserByEmail = async (email) => {
  const connection = await createDatabaseConnection("laundry_core");

  try {
    const [rows] = await connection.execute(
      `
        SELECT
          id,
          email,
          phone,
          first_name,
          middle_name,
          last_name,
          password_hash,
          is_login_enabled,
          is_active,
          created_at,
          updated_at
        FROM master_user
        WHERE email = ?
          AND is_active = TRUE
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [email]
    );

    return rows[0] || null;
  } finally {
    await connection.end();
  }
};


/**
 * ============================================================
 * Find User For Google Authentication
 * ============================================================
 *
 * Purpose:
 *   Google identity se linked user ka current account status
 *   retrieve karna.
 *
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
export const findUserForGoogleAuthentication = async (userId) => {
  const connection = await createDatabaseConnection("laundry_core");

  try {
    const [rows] = await connection.execute(
      `
        SELECT
          id,
          email,
          phone,
          first_name,
          middle_name,
          last_name,
          is_login_enabled,
          is_active,
          locked_until,
          last_login_at,
          deleted_at
        FROM master_user
        WHERE id = ?
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [userId]
    );

    return rows[0] || null;
  } finally {
    await connection.end();
  }
};