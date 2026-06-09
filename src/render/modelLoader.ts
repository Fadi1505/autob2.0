import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { ALL_MODEL_FILES, TARGET_HEIGHT, HELD_ITEM_RE } from './modelManifest';

interface LoadedModel {
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
}

const loader = new GLTFLoader();
const cache = new Map<string, Promise<LoadedModel>>();

function loadFile(file: string): Promise<LoadedModel> {
  let entry = cache.get(file);
  if (!entry) {
    entry = new Promise<LoadedModel>((resolve, reject) => {
      loader.load(
        file,
        (gltf) => resolve({ scene: gltf.scene, animations: gltf.animations }),
        undefined,
        (err) => reject(err),
      );
    });
    cache.set(file, entry);
  }
  return entry;
}

/** Preload a set of model files (used to gate the start of a duel). */
export async function preloadModels(files: string[]): Promise<void> {
  await Promise.all(files.map((f) => loadFile(f).catch(() => null)));
}

export function preloadAll(): Promise<void> {
  return preloadModels(ALL_MODEL_FILES);
}

export interface CharInstance {
  root: THREE.Group; // normalized: feet at y=0, auto-scaled to TARGET_HEIGHT
  mixer: THREE.AnimationMixer;
  clips: THREE.AnimationClip[];
  meshes: THREE.Mesh[];
}

/**
 * Returns an independent, animatable instance of a model. Skinned meshes must be
 * cloned with SkeletonUtils so each fighter has its own skeleton. The instance is
 * auto-scaled so its height equals TARGET_HEIGHT and translated so feet sit at y=0.
 */
export async function instantiate(file: string, show?: string[]): Promise<CharInstance | null> {
  let loaded: LoadedModel;
  try {
    loaded = await loadFile(file);
  } catch {
    return null;
  }

  const cloned = cloneSkeleton(loaded.scene);
  const showSet = new Set(show ?? []);

  // Pass 1: set up meshes + visibility (hide held items the hero doesn't wield).
  const meshes: THREE.Mesh[] = [];
  cloned.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      const m = o as THREE.Mesh;
      if (HELD_ITEM_RE.test(m.name) && !showSet.has(m.name)) {
        m.visible = false;
        return;
      }
      m.castShadow = true;
      m.receiveShadow = true;
      // SkeletonUtils.clone shares materials across instances; clone them so
      // per-fighter effects (death fade, hit flash) stay independent.
      if (Array.isArray(m.material)) m.material = m.material.map((mm) => mm.clone());
      else m.material = m.material.clone();
      meshes.push(m);
    }
  });

  // Normalize scale/position from the VISIBLE body meshes only, so a tall staff
  // or raised weapon doesn't shrink the character.
  cloned.updateMatrixWorld(true);
  const box = new THREE.Box3();
  for (const m of meshes) box.expandByObject(m);
  const size = new THREE.Vector3();
  box.getSize(size);
  const height = size.y || 1;
  const scale = TARGET_HEIGHT / height;

  const inner = new THREE.Group();
  inner.add(cloned);
  inner.scale.setScalar(scale);
  // After scaling, lift so the lowest point sits on the ground (y = 0).
  inner.position.y = -box.min.y * scale;

  const root = new THREE.Group();
  root.add(inner);

  const mixer = new THREE.AnimationMixer(cloned);
  return { root, mixer, clips: loaded.animations, meshes };
}
