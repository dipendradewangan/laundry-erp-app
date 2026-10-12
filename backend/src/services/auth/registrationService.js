/**
 * ============================================================
 * Laundry ERP - Registration Service
 * ============================================================
 *
 * File:
 *   src/services/auth/registrationService.js
 *
 * Purpose:
 *   Naye user ka registration handle karna.
 *
 * Responsibilities:
 *   1. Email duplicate check.
 *   2. Password hashing using bcrypt.
 *   3. User creation inside MySQL transaction.
 *   4. Registration audit event.
 *
 * Business Rules:
 *   - Email unique hona chahiye.
 *   - Phone number duplicate ho sakta hai.
 *   - Username supported nahi hai.
 *   - Password plain text mein store nahi hoga.
 * ============================================================
 */

import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";

import { executeTransaction } from "../../config/databaseTransaction.js";

import {
    findUserByEmail,
    createUser,
} from "../../repositories/auth/userRepository.js";

import {
    recordAuditEvent,
} from "../audit/auditService.js";


/**
 * Password hashing cost factor.
 */
const BCRYPT_SALT_ROUNDS = 12;


/**
 * ============================================================
 * Register User
 * ============================================================
 *
 * @param {object} params
 * @param {string} params.email
 * @param {string|null} params.phone
 * @param {string} params.firstName
 * @param {string|null} params.middleName
 * @param {string} params.lastName
 * @param {string} params.password
 * @param {object} params.requestMetadata
 *
 * @returns {Promise<object>}
 */
export const registerUser = async ({
    email,
    phone = null,
    firstName,
    middleName = null,
    lastName,
    password,

    requestMetadata = {},
}) => {
    /*
     * Normalize email again at the service boundary.
     * The validator should also normalize it.
     */
    const normalizedEmail = email.trim().toLowerCase();

    /*
     * Keep the audit metadata allowlisted.
     * Never log passwords, password hashes, or tokens.
     */
    const {
        requestId = null,
        correlationId = null,
        ipAddress = null,
        forwardedFor = null,
        userAgent = null,
    } = requestMetadata;

    let createdUser;

    try {
        /*
         * --------------------------------------------------------
         * STEP 1: Hash the password.
         * --------------------------------------------------------
         */
        const passwordHash = await bcrypt.hash(
            password,
            BCRYPT_SALT_ROUNDS,
        );

        /*
         * --------------------------------------------------------
         * STEP 2: Create user inside a MySQL transaction.
         * --------------------------------------------------------
         *
         * The database UNIQUE index on email is the final
         * protection against concurrent duplicate registrations.
         */
        createdUser = await executeTransaction(async (connection) => {
            /*
             * Friendly duplicate check.
             *
             * The UNIQUE constraint still handles race conditions
             * where another request registers the same email after
             * this check.
             */

            const existingUser = await findUserByEmail(
                normalizedEmail,
                connection,
            );

            if (existingUser) {
                const error = new Error("Email is already registered.");
                error.code = "EMAIL_ALREADY_REGISTERED";
                throw error;
            }

            const userId = randomUUID();

            return createUser({
                connection,
                id: userId,
                email: normalizedEmail,
                phone,
                firstName: firstName.trim(),
                middleName: middleName?.trim() || null,
                lastName: lastName.trim(),
                passwordHash,
            });
        });
    } catch (error) {
        /*
         * Do not expose SQL messages or database internals.
         */
        if (
            error.code === "EMAIL_ALREADY_REGISTERED" ||
            error.code === "ER_DUP_ENTRY"
        ) {
            await recordAuditEvent({
                action: "REGISTRATION_FAILED",
                module: "AUTH",
                entity: "master_user",
                attemptedIdentity: normalizedEmail,
                status: "FAILED",
                failureReason: "EMAIL_ALREADY_REGISTERED",
                requestId,
                correlationId,
                ipAddress,
                forwardedFor,
                userAgent,
            });

            return {
                success: false,
                reason: "EMAIL_ALREADY_REGISTERED",
            };
        }

        /*
         * Log only safe error context.
         * Do not include passwords or password hashes.
         */
        try {
            await recordAuditEvent({
                action: "REGISTRATION_FAILED",
                module: "AUTH",
                entity: "master_user",
                attemptedIdentity: normalizedEmail,
                status: "FAILED",
                failureReason: "REGISTRATION_PROCESS_FAILED",
                requestId,
                correlationId,
                ipAddress,
                forwardedFor,
                userAgent,
            });
        } catch (auditError) {
            /*
             * Preserve the original registration error.
             * The audit failure is not silently treated as success.
             */
            console.error(
                "Registration failure audit could not be recorded:",
                auditError.message,
            );
        }

        throw error;
    }

    /*
     * ----------------------------------------------------------
     * STEP 3: Record successful registration.
     * ----------------------------------------------------------
     *
     * The core transaction has already committed.
     * The audit database is separate, so this operation is not
     * part of the same atomic MySQL transaction.
     */
    try {
        await recordAuditEvent({
            action: "USER_REGISTERED",
            module: "AUTH",
            entity: "master_user",
            entityId: createdUser.id,
            userId: createdUser.id,
            actorName: [
                createdUser.firstName,
                createdUser.middleName,
                createdUser.lastName,
            ]
                .filter(Boolean)
                .join(" "),
            attemptedIdentity: normalizedEmail,
            status: "SUCCESS",
            requestId,
            correlationId,
            ipAddress,
            forwardedFor,
            userAgent,
            metadata: {
                registrationMethod: "PASSWORD",
            },
        });
    } catch (auditError) {
        /*
         * The user has already been created.
         * Do not report that registration failed and invite the
         * client to retry, which could create confusing results.
         *
         * A durable outbox can be added later if guaranteed audit
         * delivery is required.
         */
        console.error(
            "Registration succeeded, but audit logging failed:",
            auditError.message,
        );
    }

    /*
     * ----------------------------------------------------------
     * STEP 4: Return safe user information.
     * ----------------------------------------------------------
     *
     * Password and passwordHash are never returned.
     * Registration does not automatically create a login session.
     */
    return {
        success: true,
        user: {
            id: createdUser.id,
            email: createdUser.email,
            phone: createdUser.phone,
            firstName: createdUser.firstName,
            middleName: createdUser.middleName,
            lastName: createdUser.lastName,
        },
    };
};