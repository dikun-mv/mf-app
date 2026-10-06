# ADR 003: Canonical allocation unit (D3)

Status: accepted

## Decision

Person-months, stored as an unrounded `number`.

## Alternative

Hours.

## Why

The seed and the reference input are already in PM, so import is lossless. Capacity becomes "sum of PM per person-month > 1". The other three units are pure functions of (PM, employee, month, rates).
