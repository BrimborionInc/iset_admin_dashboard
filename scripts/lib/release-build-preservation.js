'use strict';

const fs = require('fs');
const path = require('path');

class BuildPreservationError extends Error {
  constructor(code, message, evidence = {}) {
    super(message);
    this.name = 'BuildPreservationError';
    this.code = code;
    this.evidence = evidence;
  }
}

function fail(code, message, evidence) {
  throw new BuildPreservationError(code, message, evidence);
}

function isStrictDescendant(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function validatePathList(name, values, { required = true } = {}) {
  if (!Array.isArray(values) || (required && values.length === 0)) {
    fail('BUILD_PRESERVATION_DECLARATION_MISSING', `${name} must be a non-empty array`, { declaration: name });
  }

  const normalized = values.map((value, index) => {
    if (typeof value !== 'string' || value.length === 0 || !path.isAbsolute(value)) {
      fail('BUILD_PRESERVATION_PATH_INVALID', `${name}[${index}] must be an absolute path`, {
        declaration: name,
        index,
      });
    }
    return path.normalize(value);
  });

  const duplicate = normalized.find((value, index) => normalized.indexOf(value) !== index);
  if (duplicate) {
    fail('BUILD_PRESERVATION_PATH_DUPLICATE', `${name} contains a duplicate path`, {
      declaration: name,
      path: duplicate,
    });
  }
  return normalized;
}

function validatePreservationPlan(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    fail('BUILD_PRESERVATION_PLAN_INVALID', 'preservation plan must be an object');
  }

  const allowedRoots = validatePathList('allowedRoots', plan.allowedRoots);
  const generatedFiles = validatePathList('generatedFiles', plan.generatedFiles);
  const outputRoots = validatePathList('outputRoots', plan.outputRoots);

  for (const candidate of [...generatedFiles, ...outputRoots]) {
    const owners = allowedRoots.filter(root => isStrictDescendant(root, candidate));
    if (owners.length !== 1) {
      fail('BUILD_PRESERVATION_PATH_ESCAPE', 'declared path must belong to exactly one allowed root', {
        path: candidate,
        ownerCount: owners.length,
      });
    }
  }

  for (let index = 0; index < outputRoots.length; index += 1) {
    for (let other = index + 1; other < outputRoots.length; other += 1) {
      if (
        isStrictDescendant(outputRoots[index], outputRoots[other]) ||
        isStrictDescendant(outputRoots[other], outputRoots[index])
      ) {
        fail('BUILD_PRESERVATION_OUTPUT_OVERLAP', 'output roots must not overlap', {
          paths: [outputRoots[index], outputRoots[other]],
        });
      }
    }
  }

  for (const generatedFile of generatedFiles) {
    const outputRoot = outputRoots.find(root => generatedFile === root || isStrictDescendant(root, generatedFile));
    if (outputRoot) {
      fail('BUILD_PRESERVATION_GENERATED_OUTPUT_OVERLAP', 'generated files must not be inside output roots', {
        generatedFile,
        outputRoot,
      });
    }
  }

  return Object.freeze({
    allowedRoots: Object.freeze(allowedRoots),
    generatedFiles: Object.freeze(generatedFiles),
    outputRoots: Object.freeze(outputRoots),
  });
}

function snapshotGeneratedFile(filename) {
  if (!fs.existsSync(filename)) return Object.freeze({ path: filename, state: 'absent' });

  const stat = fs.lstatSync(filename);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    fail('BUILD_PRESERVATION_GENERATED_TYPE_INVALID', 'generated path must be absent or a regular file', {
      path: filename,
    });
  }
  return Object.freeze({ path: filename, state: 'present', bytes: fs.readFileSync(filename) });
}

function restoreGeneratedFile(snapshot) {
  fs.rmSync(snapshot.path, { recursive: true, force: true });
  if (snapshot.state === 'present') {
    fs.mkdirSync(path.dirname(snapshot.path), { recursive: true });
    fs.writeFileSync(snapshot.path, snapshot.bytes);
  }
}

function serializeFailure(error) {
  return {
    code: error && error.code ? String(error.code) : null,
    message: error && error.message ? error.message : String(error),
  };
}

function runWithBuildPreservation(plan, action) {
  const validated = validatePreservationPlan(plan);
  if (typeof action !== 'function') {
    fail('BUILD_PRESERVATION_ACTION_INVALID', 'preserved action must be a function');
  }

  const snapshots = validated.generatedFiles.map(snapshotGeneratedFile);
  const admittedOutputRoots = new Set(validated.outputRoots);
  const evidence = {
    generatedFiles: [...validated.generatedFiles],
    outputRoots: [...validated.outputRoots],
    restoration: 'pending',
  };
  let actionFailure = null;
  let actionResult;

  try {
    for (const outputRoot of validated.outputRoots) {
      fs.rmSync(outputRoot, { recursive: true, force: true });
    }
    actionResult = action(
      Object.freeze({
        generatedFiles: validated.generatedFiles,
        outputRoots: validated.outputRoots,
        assertOutputRoot(candidate) {
          const normalized = typeof candidate === 'string' ? path.normalize(candidate) : candidate;
          if (!admittedOutputRoots.has(normalized)) {
            fail('BUILD_PRESERVATION_OUTPUT_UNDECLARED', 'action requested an undeclared output root', {
              path: normalized || null,
            });
          }
          return normalized;
        },
      })
    );
    if (actionResult && typeof actionResult.then === 'function') {
      fail('BUILD_PRESERVATION_ACTION_ASYNC', 'preserved action must complete synchronously');
    }
  } catch (error) {
    actionFailure = error;
  }

  const restorationFailures = [];
  for (const outputRoot of validated.outputRoots) {
    try {
      fs.rmSync(outputRoot, { recursive: true, force: true });
    } catch (error) {
      restorationFailures.push({ phase: 'output-cleanup', path: outputRoot, ...serializeFailure(error) });
    }
  }
  for (const snapshot of snapshots) {
    try {
      restoreGeneratedFile(snapshot);
    } catch (error) {
      restorationFailures.push({ phase: 'generated-restore', path: snapshot.path, ...serializeFailure(error) });
    }
  }

  if (restorationFailures.length > 0) {
    evidence.restoration = 'failed';
    fail('BUILD_PRESERVATION_RESTORATION_FAILED', 'build preservation restoration failed', {
      ...evidence,
      actionFailure: actionFailure ? serializeFailure(actionFailure) : null,
      failures: restorationFailures,
    });
  }

  evidence.restoration = 'passed';
  if (actionFailure) throw actionFailure;
  return Object.freeze({ actionResult, evidence: Object.freeze(evidence) });
}

module.exports = {
  BuildPreservationError,
  runWithBuildPreservation,
  validatePreservationPlan,
};
