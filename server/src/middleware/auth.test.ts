import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { authenticate } from '../middleware/auth.js';
import type { Request, Response, NextFunction } from 'express';

const SECRET = 'fallback-dev-secret';

function makeReq(authHeader?: string): Request {
  return { headers: { authorization: authHeader } } as unknown as Request;
}

function makeRes(): { res: Response; statusCode: () => number; body: () => unknown } {
  let _statusCode = 200;
  let _body: unknown;
  const json = jest.fn((b) => { _body = b; });
  const status = jest.fn((code: number) => { _statusCode = code; return { json }; });
  const res = { status, json } as unknown as Response;
  return { res, statusCode: () => _statusCode, body: () => _body };
}

// ── Valid token ──────────────────────────────────────────────

test('calls next() and sets req.user when token is valid', () => {
  const token = jwt.sign({ userId: 42 }, SECRET);
  const req = makeReq(`Bearer ${token}`);
  const { res } = makeRes();
  const next = jest.fn() as unknown as NextFunction;

  authenticate(req, res, next);

  expect(next).toHaveBeenCalledTimes(1);
  expect(req.user).toEqual({ userId: 42 });
});

test('does not call res.status when token is valid', () => {
  const token = jwt.sign({ userId: 7 }, SECRET);
  const req = makeReq(`Bearer ${token}`);
  const { res } = makeRes();
  const next = jest.fn() as unknown as NextFunction;

  authenticate(req, res, next);

  expect((res.status as jest.Mock).mock.calls.length).toBe(0);
});

// ── Missing header ───────────────────────────────────────────

test('returns 401 when Authorization header is absent', () => {
  const req = makeReq(undefined);
  const { res, statusCode } = makeRes();
  const next = jest.fn() as unknown as NextFunction;

  authenticate(req, res, next);

  expect(statusCode()).toBe(401);
  expect(next).not.toHaveBeenCalled();
});

test('returns 401 when Authorization header is empty string', () => {
  const req = makeReq('');
  const { res, statusCode } = makeRes();
  const next = jest.fn() as unknown as NextFunction;

  authenticate(req, res, next);

  expect(statusCode()).toBe(401);
  expect(next).not.toHaveBeenCalled();
});

// ── Wrong scheme ─────────────────────────────────────────────

test('returns 401 when header uses Basic scheme instead of Bearer', () => {
  const req = makeReq('Basic c29tZXVzZXI6cGFzc3dvcmQ=');
  const { res, statusCode } = makeRes();
  const next = jest.fn() as unknown as NextFunction;

  authenticate(req, res, next);

  expect(statusCode()).toBe(401);
  expect(next).not.toHaveBeenCalled();
});

// ── Invalid / tampered token ─────────────────────────────────

test('returns 401 for a completely invalid token string', () => {
  const req = makeReq('Bearer not.a.valid.token');
  const { res, statusCode } = makeRes();
  const next = jest.fn() as unknown as NextFunction;

  authenticate(req, res, next);

  expect(statusCode()).toBe(401);
  expect(next).not.toHaveBeenCalled();
});

test('returns 401 for a token signed with a different secret', () => {
  const token = jwt.sign({ userId: 1 }, 'wrong-secret');
  const req = makeReq(`Bearer ${token}`);
  const { res, statusCode } = makeRes();
  const next = jest.fn() as unknown as NextFunction;

  authenticate(req, res, next);

  expect(statusCode()).toBe(401);
  expect(next).not.toHaveBeenCalled();
});

test('returns 401 for an expired token', () => {
  const token = jwt.sign({ userId: 1 }, SECRET, { expiresIn: -1 });
  const req = makeReq(`Bearer ${token}`);
  const { res, statusCode } = makeRes();
  const next = jest.fn() as unknown as NextFunction;

  authenticate(req, res, next);

  expect(statusCode()).toBe(401);
  expect(next).not.toHaveBeenCalled();
});

// ── userId extraction ─────────────────────────────────────────

test('correctly extracts userId from token payload', () => {
  const token = jwt.sign({ userId: 999 }, SECRET);
  const req = makeReq(`Bearer ${token}`);
  const { res } = makeRes();
  const next = jest.fn() as unknown as NextFunction;

  authenticate(req, res, next);

  expect(req.user?.userId).toBe(999);
});
