---
title: "A Survey of the Security Risks of File Hash Leaks"
slug: survey-on-filehash-leaks
translationKey: survey-on-filehash-leaks
date: 2026-04-22T08:18:49+08:00
source: yuque/penetration
---

::::danger
A Survey of the Security Risks of File Hash Leaks

I did a dedicated round of research on this question, in both Chinese and English sources. Conclusion first: **the answer to "is a file hash leak harmful" is not a simple yes or no — it is highly context-dependent.**

::::



![](https://cdn.nlark.com/yuque/0/2026/png/166008/1776817128586-d8e95fdd-f21a-45c8-9a4a-232395d4dd2e.png)



If the hash is merely an offline integrity-check value — for example the `SHA256SUMS` file publicly published on a Linux distribution's official site — it is usually not a secret. On the contrary, it should be published and signed so users can verify download integrity and authenticity of origin. This is exactly how [Fedora's official verification instructions](https://fedoraproject.org/en/security/), [Debian's official image verification instructions](https://www.debian.org/CD/verify.en.html), and [Ubuntu's official tutorial](https://ubuntu.com/tutorials/how-to-verify-ubuntu) are designed.

But if the system uses file hashes as **content identity, existence probes, deduplication credentials, content addresses, or sample lookup keys**, the situation is completely different. Here, although the leaked hash is only a few bytes, it can become an entry point for retrieving, confirming, correlating, and even recovering large files. From an engineering-security perspective, it is often no longer a "harmless digest" but part of a **capability**.

I will develop the argument in three layers below. First, the real-world attack surface and history in the context of Chinese cloud drives' "instant upload / offline download" features; second, the systematic discussion of deduplication, proof-of-ownership, and content addressing in English papers and official documentation; third, a more rigorous judgment on the proposition "should a file hash be kept as confidential as the file itself."

## I. Why This Question Deserves Re-examination
Many people's first reaction to hashes is: they are irreversible, so a leak doesn't matter. This judgment is only half right.

In cryptography, a strong hash is indeed not reversible encryption. Looking at a single `SHA-256` value alone, an attacker usually cannot conjure up the original arbitrary large file. That point stands.

The problem is that **real-world systems do not leave hashes sitting in isolation**. Platforms wire them into indexing, deduplication, retrieval, sharing, intelligence aggregation, and known-file identification. Once a hash enters these systems, its role shifts from "digest" to "index key."

To put it more plainly:

+ From a pure cryptography perspective, a hash is like a "compressed fingerprint."
+ In a real engineering system, it is more like "the file's ID number + primary lookup key within a given ecosystem."

The security implications of these two are completely different.

## II. The Chinese Cloud Drive Context: Why Hashes Become a Real Attack Surface
### 1. "Instant upload" is essentially using a short identifier to skip a long transfer
An article on instant-upload technology from Baidu Netdisk's enterprise edition is labeled "AI-generated" and cannot be used as strong evidence, but it at least accurately reflects the industry's public narrative: when a file is uploaded, a hash is computed first and compared against files already in the cloud; if they match, the full transfer is skipped and a correspondence is established directly. [Source](https://eyun.baidu.com/content/522730/)

The judicial and academic materials are more valuable. In the discussion of the Baidu Netdisk "Shi Wei Nu" case, public materials have already made the core of "instant-upload-style offline download" fairly clear: the platform first parses the index file, identifies the `MD5` of the file to be downloaded, then compares it against files already stored on the server; on a hit, it establishes a mapping rather than re-transferring the full content. [Center for Coordination and Innovation of Judicial Civilization article](https://www.cicjc.com.cn/info/1041/16442.htm), [Supreme People's Court Intellectual Property Court workshop excerpt](https://ipc.court.gov.cn/zh-cn/news/view-3592.html)

The key point here is not any single product detail, but the very important security structure it reveals:

**In certain system designs, a short file fingerprint is sufficient to drive the transfer of a large file's availability.**

In other words, the hash does not merely "describe the file" — in certain scenarios it "stands in for the file."

### 2. The history of cloud drive governance in China shows this is not a paper-theory problem
In 2015, the National Copyright Administration issued a document on copyright order for cloud drive services, requiring providers to take measures such as deleting infringing works, blocking sharing, and preserving user information. When the Cyberspace Administration of China reposted Beijing Daily's interpretation, it explicitly pointed out that at the time, platforms such as Baidu Netdisk, 360 Cloud Drive (Yunpan), Kingsoft KuaiPan, Tencent Weiyun, Sina VDisk, and Xunlei Kuaipan had become important channels for distributing pirated audio, video, and written works. [CAC reposted interpretation](https://www.cac.gov.cn/2015-10/26/c_1116934785.htm)

The regulatory implication behind this is clear: **cloud drives stopped being "purely private storage" long ago — they are a link in the real distribution chain.**

The subsequent historical milestones are also telling:

+ In 2012, 115 Cloud Drive shut down its public sharing feature due to "policy risks and copyright disputes," an early turning point in Chinese cloud drive governance. [CCTV repost](https://news.cntv.cn/20120807/118674.shtml)
+ In 2016, 360 Cloud Drive announced it would terminate its personal cloud drive service, with the publicly stated reasons directly including illegal files, copyright infringement and piracy, and distribution of pornographic material. [Xinhuanet report](https://www.xinhuanet.com/zgjx/2016-10/21/c_135770840.htm)
+ In 2019, in the Youku v. Baidu Netdisk case, the court found that Baidu Netdisk, after receiving rights-holder notices, failed to take sufficient timely measures and allowed large numbers of infringing links to keep spreading. Public reports mentioned the scale of infringing links at issue exceeded 11,000. [Dezhou Intermediate Court repost of case report](https://www.sdcourt.gov.cn/dzzy/392143/392145/5818823/index.html)

These materials do not necessarily all discuss "hash leaks" directly, but together they demonstrate one point: **once a platform has the combination of "storage + indexing + sharing + saving-to-drive/instant upload," hash-type identifiers easily enter large-scale distribution chains.**

### 3. The real attack surface comes not from the hash alone, but from "hash + platform capability"
In my view, what deserves the most attention in the Chinese cloud drive context is not "whether the hash is reversible" but the following classes of engineering attack surfaces:

#### Attack Surface A: Existence confirmation
If the platform supports cross-user deduplication, knowing a file's hash may effectively let you confirm whether that file already exists on the platform. For popular films and shows, infringing resources, or malicious samples, this confirmation alone has value.

#### Attack Surface B: Direct reuse after an index hit
If the platform allows establishing a "mapping" based on a hash or equivalent fingerprint without re-uploading the full file, then a leaked hash can become a content retrieval entry point. It is not the original file, but it is enough to trigger reuse of the original.

#### Attack Surface C: Piecing together external distribution chains
Real-world attacks are often not completed at a single point; they are assembled from multiple leak surfaces. When public share links, index files, file sizes, upload times, titles, third-party drive-search engines, community scripts, and offline-download features are stacked together, the hash goes from "technical field" to "distribution hub."

The 2017 reporting on third-party "drive search" engines scraping public cloud drive share links is a typical example. The problem does not necessarily lie with the hash alone — file identifiers, links, and search capability together form the information leak chain. [People's Daily report](https://it.people.com.cn/GB/n1/2017/0722/c1009-29422086.html)

## III. Core Conclusions from English-Language Sources: The Risk Comes from Dedup, PoW, and Content Addressing
![](https://cdn.nlark.com/yuque/0/2026/png/166008/1776817128698-032db3a0-14ae-49a1-9e94-22b987d76470.png)

If you look only at the English-language literature, this question has in fact been discussed for many years, and the conclusions are quite consistent: **the core risk of a hash leak is not "can the hash be inverted to the original," but "does the system treat the hash as proof of a file's existence, ownership, or content identity."**

### 1. Deduplication turns the hash into an "existence probe"
Harnik, Pinkas, and Shulman-Peleg, in *Side Channels in Cloud Services: Deduplication in Cloud Storage*, point out that cross-user deduplication naturally forms a side channel. An attacker only needs to upload candidate files and observe whether deduplication occurs to determine whether other users already possess the file. [Paper PDF](https://www.pinkas.net/PAPERS/hps.pdf)

This attack is critical because it punctures a common misconception: **even if the platform never exposes file contents directly, as long as it reveals "is this a duplicate," outsiders have already gained an existence oracle.**

The paper even gives very realistic examples, such as using deduplication to determine whether someone holds a sensitive file, or enumerating a small number of unknown fields in a templated document.

### 2. "Knowing only the hash may still get you the original file" is a classic design flaw
Halevi et al.'s *Proofs of Ownership in Remote Storage Systems* goes further and states the problem very bluntly: if a system uses only the file hash to judge that a client "possesses" a file, then an attacker who knows that hash may fool the server and subsequently obtain the complete file. [IACR ePrint](https://eprint.iacr.org/2011/207)

This paper is highly valuable because it does not speak in generalities; it explicitly models the problem as:

+ the attacker possesses minimal side information;
+ the server mistakenly treats a short value as proof of ownership;
+ the result is that the attacker obtains an arbitrarily large file.

In other words, in such systems, **the hash is no longer metadata — it is an access primitive.**

### 3. Deduplication-friendly encryption does not have "strong confidentiality" in the ordinary sense
Bellare, Keelveedhi, and Ristenpart, in *Message-Locked Encryption and Secure Deduplication*, proposed MLE (message-locked encryption), which is essentially an admission: if a system requires both deduplication and encryption, then the security model cannot be understood as ordinary randomized encryption. [IACR ePrint](https://eprint.iacr.org/2012/631)

The subsequent DupLESS work states even more explicitly that designs like convergent encryption are susceptible to dictionary/brute-force attacks, especially when messages come from a low-entropy space, a known corpus, or template files: the attacker can enumerate candidate contents to match the target file. [DupLESS paper](https://eprint.iacr.org/2013/429.pdf)

This point is especially important, because it shows:

**"A hash is only a few bytes" does not automatically mean "the attack is hard."**

What really determines the difficulty of the attack is the size of the target file's candidate space, and whether the attacker can plug the hash into a system that enables "verifiable guessing."

### 4. Learn-the-Remaining-Information: enumerating low-entropy fields is a real risk
Tahoe-LAFS's official documentation has long discussed a famous problem: the Learn-the-Remaining-Information attack. The typical scenario is that the attacker already knows most of a document's contents, with only a few fields unknown — a salary, an account number, a balance, or some ID. The attacker can then enumerate the remaining fields, generate candidate files, compute the corresponding fingerprints, and compare them against the target value, thereby recovering the secret. [Tahoe-LAFS documentation PDF](https://tahoe-lafs.readthedocs.io/_/downloads/en/tahoe-lafs-1.14.0/pdf/)

The lesson of this class of attacks is significant: **the hash did not magically "compress out" high-entropy information; what actually happened is that the attacker, using templates, context, and a candidate space, transformed an apparently high-entropy large file into a small number of variables to enumerate.**

So from an information-theoretic standpoint, the more accurate statement is not "low-entropy data inverted high-entropy data," but rather:

**the system exposed a very powerful decision interface that allows outside prior knowledge to efficiently pin down the original text.**

### 5. Deduplication side channels have seen real remote attacks
The 2022 USENIX FAST paper DUPEFS demonstrated how modern filesystem deduplication side channels leak information in real systems. In a dedup-enabled ZFS scenario, the authors slowly leaked real sensitive data such as OAuth tokens through remote methods. [USENIX FAST 2022](https://www.usenix.org/conference/fast22/presentation/bacs)

Although the rate was not high, this is enough to establish one fact: **as long as the "duplicate state" itself is probeable, real secrets may keep leaking even if the plaintext is never visible.**

### 6. In content-addressed systems, the hash IS the address
The more radical scenario is content-addressed systems. The early CASPER paper already pointed out that recipe/checksum queries themselves leak what the user is requesting, because an attacker holding a database of common chunks can infer what is being accessed. [CASPER paper](https://www.usenix.org/event/usenix03/tech/full_papers/tolia/tolia_html/usenix03.html)

IPFS's official documentation still emphasizes today that although inter-node communication can be encrypted, public metadata such as CIDs, PeerIDs, and DHT provider records exposes who is providing or requesting a given content identifier. [IPFS official docs](https://docs.ipfs.tech/concepts/privacy-and-encryption/)

Here there is almost no room for the debate "is the hash the file," because in content-addressed systems, **the hash is the content address**. Strictly speaking it does not equal the file itself, but it is also hard to still view it as a mere harmless digest.

### 7. In threat-intelligence systems, the hash has long been the "sample primary key"
VirusTotal's official API documentation explicitly states that the ID of a file object is its `SHA-256`, and supports querying file reports, metadata, and even partial download capability directly by hash. [VirusTotal Files API](https://docs.virustotal.com/reference/files), [file download API](https://docs.virustotal.com/reference/files-download)

MalwareBazaar's official API likewise allows downloading malicious sample archives by `sha256_hash`. [MalwareBazaar Community API](https://bazaar.abuse.ch/hunting/yara/remsec_encrypted_api/)

NIST NSRL has long used hashes as one of the core fields for known-file identification, for forensic identification and archival. [NIST NSRL FAQ](https://www.nist.gov/itl/ssd/software-quality-group/national-software-reference-library-nsrl/about-nsrl/nsrl-frequently-0)

This shows that in the real world, the hash stopped being "just an integrity check value" long ago. It has become:

+ the primary query key of intelligence platforms;
+ the locating key of sample repositories;
+ the identifier within known-good / known-bad ecosystems.

Once the hash of a private file enters such a system, even if the original file is never made public, third parties can still complete **confirmation, semantic classification, correlation analysis, and source enrichment.**

## IV. From a Red Team Perspective: New Attack Surfaces Often Hide Inside "Optimization Goals"
![](https://cdn.nlark.com/yuque/0/2026/png/166008/1776817128649-8a9d19e9-0e90-49df-8468-83b5c0dd54d4.png)

Placed within red team methodology, the value of this question lies not only in "do hashes carry risk," but in that it suggests a new way of extracting attack surfaces:

**Do not stare only at traditional boundaries, and do not stare only at explicit interfaces; instead, prioritize reviewing what optimizations a system has made for efficiency, cost, and experience.**

Cloud drives are just a typical example. For large-scale storage systems, deduplication is almost a natural urge:

+ duplicate files are numerous;
+ bandwidth and storage costs are high;
+ users want "instant upload";
+ platforms want to reduce redundant copies;
+ popular content naturally has cross-user reuse value.

So the question is often not "will the system do deduplication" but "through what mechanism will the system do deduplication." And once the question is rephrased in this form, the red team's observation points shift immediately.

### 1. Shift from the functional surface to the cost structure
Traditional attack surface analysis tends to start from "which APIs are exposed," "what authentication flaws exist," "can we download beyond authorization." That path is of course important, but it easily overlooks the cost constraints behind the system.

If the red team flips the perspective and observes from **what cost the platform most wants to eliminate**, it can often find high-value surfaces faster:

+ Wanting to save bandwidth leads to client-side deduplication, resumable-skip upload, and offline pulling;
+ Wanting to save storage leads to single-instance storage, block-level reuse, hard links, or reference counting;
+ Wanting to save CPU may lead to weakened strong verification, tiered verification, partial fingerprints, or cache hits;
+ Wanting to improve experience exposes status feedback such as "does it already exist," "did instant upload succeed," "was a resource hit."

And once these optimizations are in place, the attack surface is no longer just "the file download interface"; it expands into:

+ whether a deduplication-hit oracle exists;
+ whether resource-existence feedback exists;
+ whether a short fingerprint is mistaken for proof of ownership;
+ whether mappings can be established directly via index values;
+ whether block-level or file-level content identity is leaked.

In other words, **the new red team mindset is not chasing explicit vulnerabilities, but reasoning backward along the system's optimization path: to be faster, cheaper, and more economical, what observable, forgeable, and reusable signals must it have introduced?**

### 2. Shift from the "data plane" to the "control plane"
Hash-type problems have another easily underestimated aspect: the attack target is not necessarily the data plane itself; it may also be the control plane.

In many systems, the hash does not directly equal file content, but it can control:

+ whether to upload;
+ whether to download;
+ whether to establish a reference;
+ whether to hit the cache;
+ whether to trigger sample correlation;
+ whether to obtain an access path to an existing object.

This means the red team, when modeling, needs to treat the hash as a **control signal**. Once a control signal can be guessed, forged, replayed, or queried externally, an attack surface appears.

So in the cloud drive scenario, what is truly dangerous is not "the digest was seen," but:

**once the digest enters the control plane, it may acquire informational leverage far beyond the digest itself.**

### 3. It is more like a cache system than a hash table
Abstracting further, this kind of structure is less like a traditional hash table and more like a **cache or object-reuse system driven by content identity**.

The intuitions of a traditional hash table are:

+ the key is merely a lookup aid structure;
+ the value is the primary asset;
+ key leakage usually has no direct business value;
+ whether the key can be shared externally is usually not a precondition for the system to function.

But deduplication, instant upload, and content addressing are not like that.

The reason they are closer to cache systems is:

+ the system has already stored a high-cost object;
+ the goal is to reuse existing objects as much as possible, rather than repeatedly generating or re-transmitting;
+ a smaller identity tag is used to hit a larger object;
+ once the hit succeeds, the follow-up action is often not "return index information," but directly skip the upload, establish a reference, return the object, or trigger a copy.

From this angle, the "hash" discussed in this article is really more like a **content-derived cache key**. It does not exist to implement general key-value mapping, but to hit an already-existing large object at low cost in large-scale object-reuse scenarios.

This also explains why it exhibits a typical "leveraging the small to move the large" structure:

+ the small thing is the key, tag, digest, fingerprint;
+ the large thing is the real object being indexed, reused, retrieved;
+ the danger lies not in the small object itself, but in whether it can reliably hit the large object.

This has one key difference from cache keys in ordinary applications: **ordinary cache keys are usually internal implementation details, whereas the keys here usually come from the message itself — which is shareable, computable, and transmissible.**

### 4. Message shareability determines that this class of keys is inherently prone to spilling out
When conventional engineering discusses cache security, the default premise is usually that cache keys belong to an internal namespace. For example:

+ user ID + parameter concatenation;
+ SQL template + query conditions;
+ internal paths, tenant IDs, function arguments;
+ derived keys known only to the server.

The typical characteristics of such keys are: **outsiders cannot easily construct them fully, and they are not suitable for public distribution.**

But message-locked / content-derived systems are precisely the opposite.

Their keys often come directly or indirectly from the message:

+ the file content itself;
+ the hash of the file content;
+ fingerprints of the file after chunking;
+ tags, CIDs, ETags, or equivalent object identities derived from the message.

And the messages themselves are, in reality, frequently shareable:

+ a popular installer gets downloaded repeatedly;
+ a public PDF is held by many people;
+ a malicious sample circulates within the intelligence community;
+ a pirated film resource keeps being forwarded within communities;
+ a templated document gets generated by large numbers of users from the same template.

This means "compute and share the hash" is not fringe behavior — it is a very natural collaborative behavior. Precisely because of this, such systems face not "will the key occasionally leak," but:

**the key will, in many scenarios, be computed, forwarded, compared, and discussed as a matter of course.**

Once the system design still assumes "as long as the original file is not public, it doesn't matter if the key is public," the risk will be systematically underestimated.

Therefore, from the defense perspective, a more accurate judgment is:

**when the key derives from the message, and the message itself is shareable, the traditional intuitions about internal cache keys should no longer apply.**

What should actually be assumed is:

+ the attacker may compute the key themselves;
+ the attacker may obtain the key from a third party;
+ the key may appear in logs, forums, intelligence platforms, scripts, and automation tools;
+ key leakage is not an anomaly, but part of the system's way of working spilling outward.

### 5. A transferable method: extending from cloud drives to other systems
This method is not limited to cloud drives.

Any system with the following goals is worth examining with the same red team thinking:

+ cache-hit optimization in content delivery networks;
+ layer reuse in container image registries;
+ block-level deduplication in backup systems;
+ single-instance archival in data lakes and object storage;
+ known-file queries on malicious-sample platforms;
+ CID/DHT lookups in content-addressed networks.

These systems appear to solve performance or cost problems on the surface, yet at the bottom they often introduce the same class of security tension:

**to identify "is this the same object," the system must expose some stable identity; and once that stable identity can be exploited externally, it may turn from optimization metadata into an attack entry point.**

Therefore, from the red team perspective, the genuinely new idea this article wants to point out is:

**Attack surfaces do not always come from feature expansion; they may also come from optimization convergence. The more precisely, quickly, and cheaply a system tries to identify "identical content," the more likely it is to spill content identity out as a security problem.**

## V. From an Information-Theoretic Angle: The Judgment Has a Real Basis, but the Statement Needs to Be More Precise
One very representative judgment is: the hash value is very short, yet it can "move a thousand pounds with four ounces" by pointing to a multi-gigabyte original file — this looks like low-entropy data recovering high-entropy data.

I believe this intuition is **valid in engineering terms, but needs correction in information-theoretic terms**.

### 1. Why it "holds in engineering terms"
If the platform wires the hash into the following capabilities:

+ deduplication hits;
+ lax ownership verification;
+ content addressing;
+ known-sample lookup;
+ malicious-sample download;
+ public sharing / index mapping;

then a 32-byte `SHA-256` really can trigger the discovery, reuse, or download of a multi-gigabyte file. In terms of engineering consequences, that is indeed "moving a thousand pounds with four ounces."

### 2. Why it "cannot simply be called inversion in information-theoretic terms"
Because the hash itself creates no information and violates no conservation of entropy. What actually makes recovery possible is that **the outside world has already supplied additional information**:

+ the attacker knows the candidate files come from some finite set;
+ the attacker holds a template, with only a few unknown fields;
+ the platform has already stored a copy of the file;
+ a third-party intelligence database has already indexed the file;
+ the system uses the hash as a lookup key or capability token.

So the more rigorous statement should be:

**The danger of a file hash leak lies not in the hash alone containing all the information of the original file, but in its ability to combine with external corpora, indexing systems, and verification oracles to dramatically reduce the cost of recovering or confirming the original file.**

This does not contradict "cryptographic one-wayness."

## VI. So, Should a File Hash Be Kept as Confidential as the File Itself?
This is the question I most wanted to answer seriously in this round of research.

My conclusion is:

**Treating "a file hash should always be kept as confidential as the file itself" as an absolute proposition is too strong.**

But rephrased as the following, I believe it holds up:

**When a file hash is used by a system as content identity, for deduplication, existence confirmation, content addressing, sample lookup, or access mapping, its sensitivity should be handled as "high-risk metadata" or even "quasi-access credential," and no longer as an ordinary digest.**

In other words, distinguish by scenario:

### Scenario A: The hash usually needs no confidentiality
+ Checksums published on official software release pages;
+ ISOs, installers, and open-source tarballs already distributed to the public;
+ Public files used for integrity verification with no additional lookup capability bound to them.

In these scenarios, publishing the hash is actually a good thing — provided it is paired with a signature scheme, to prevent "the file and the hash being tampered with together." This is the practice repeatedly emphasized by the official Fedora, Debian, and Ubuntu documentation. [Fedora](https://fedoraproject.org/en/security/), [Debian](https://www.debian.org/CD/verify.en.html), [Ubuntu](https://ubuntu.com/tutorials/how-to-verify-ubuntu)

### Scenario B: The hash should be treated as sensitive metadata
+ Private documents, contracts, pay slips, medical records, evidentiary materials;
+ heavily templated files with a small candidate space;
+ files that will be consumed by deduplication systems, intelligence systems, sample repositories, or content-addressed networks;
+ systems where a leaked hash may trigger existence confirmation or hit-based download.

In these scenarios, although the hash is not the file itself, its value to an attacker is already high enough.

### Scenario C: The hash is nearly equivalent to a capability token
+ The platform allows "knowing the hash is enough to save/extract/download";
+ malicious-sample platforms allow downloading samples directly by hash;
+ content-addressed networks use hash/CID directly as the content address;
+ the system internally uses the hash as an access key.

In this scenario, the claim "the hash's confidentiality should approach that of the file itself" is very close to the truth. Because what leaks at this point is no longer just a digest, but **part of the access path**.

## VII. Wanting Both Deduplication and Security: What Engineering Solutions Can Actually Be Deployed
![](https://cdn.nlark.com/yuque/0/2026/png/166008/1776817128689-afd0c888-abee-4134-a837-a47f98b37418.png)

Since deduplication is almost an innate requirement of large-scale storage systems, the truly valuable question is not "disable deduplication," but "how to keep the benefits of deduplication while preventing the deduplication capability from becoming an attack surface."

Existing papers and engineering experience roughly point to the following composable approaches.

### 1. Do not treat a short fingerprint as proof of ownership
This is the most basic rule, and the core reason the PoW paper was written.

If a system concludes that a client "possesses" data based solely on a file hash, a block hash, or some static tag, it is essentially misusing a digest as a credential. The sounder approach is to introduce **Proof of Ownership**, requiring the client to prove it actually holds the file content itself, rather than merely knowing a short value. [Halevi et al.](https://eprint.iacr.org/2011/207)

In engineering terms, this means:

+ do not allow "knowing the hash means instant upload succeeds";
+ do not allow "knowing the object ID means joining the reference";
+ still require proof of content possession after a deduplication hit;
+ before establishing a mapping, at least spot-check several unpredictable data blocks.

This principle adds some latency, but it directly blocks the path of "claiming a large file with only side information."

### 2. Reduce the observability of deduplication state
Many attacks succeed not because the system allows direct downloads, but because the system exposes the "hit / no-hit" state too plainly.

Therefore, the second principle is: **even if deduplication happens internally, do not casually feed the deduplication status back to the outside.**

Feasible measures include:

+ completing deduplication server-side, rather than having the client ask first and then decide whether to upload;
+ unifying the external upload flow, so that whether a hit occurred cannot be read directly from network traffic, timing, or response semantics;
+ disabling cross-user deduplication for small files, template files, and highly sensitive files;
+ introducing randomization, delay, or additional verification for high-risk hit results, to reduce the exploitability of the existence oracle.

The random-threshold idea proposed by Harnik et al. is essentially about weakening the strong correspondence between "hit state" and "file already exists." [Paper PDF](https://www.pinkas.net/PAPERS/hps.pdf)

### 3. Do tiered deduplication, not global deduplication
From a security perspective, the most dangerous thing is usually not "deduplication" itself, but **global deduplication across tenants, across users, across security domains.**

Therefore, a very practical compromise is layered handling:

+ allow deduplication within a single user's domain;
+ make deduplication optional within one enterprise tenant;
+ no deduplication across tenants by default;
+ adopt different strategies for publicly known large files versus private files.

The cost of doing this is sacrificing some global storage savings, but it greatly reduces the risks of confirmation attacks, lateral inference, and sensitive content-identity leakage.

The reason many so-called "zero-knowledge cloud drives" skip cross-account dedup is, at its core, trading storage efficiency for a privacy boundary.

### 4. Disable "stable identity" for high-risk file types
Not all files deserve to be handled with the same dedup policy.

For the following types, it is more appropriate to disable cross-user stable identity outright:

+ templated private documents such as contracts, pay slips, invoices, and medical records;
+ high-value forensic materials;
+ sensitive configurations, key bundles, certificate archives;
+ standard-format files known to be within an attacker's candidate space.

Because these files are the most susceptible to LRI, confirmation attacks, or known-file correlation attacks. Pursuing extreme dedup on them is usually not worth the security cost.

### 5. Make "content identity" valid only within controlled domains
If the system must rely on content identity for indexing, then the sounder approach is not to make it fully public, but to make it valid only within a controlled domain.

This means:

+ external interfaces do not directly expose the raw content hash;
+ internal indexes may use salted tags, tenant-domain-bound tags, or identifiers after controlled transformation;
+ external download, sharing, and saving-to-drive are not allowed to use the raw hash directly as a capability key;
+ the content-addressing layer and the access-control layer are separated, so that "knowing the ID" does not naturally imply "authorized to access."

This line of thinking is consistent with the basic direction behind MLE / DupLESS: acknowledging the economic value of dedup while avoiding exposing a publicly computable content identity directly as an attack entry point. [MLE](https://eprint.iacr.org/2012/631), [DupLESS](https://eprint.iacr.org/2013/429.pdf)

### 6. Move the risk-control focus from "file content" forward to "identity signals"
Many platforms concentrate their governance actions on after-the-fact file deletion, link takedown, and account bans. But from the defense perspective, the earlier layer is actually:

**which stable identity signals, once leaked, can be reused to spread content.**

Therefore, security design should bring the following objects into risk-control scope:

+ file-level and block-level hashes;
+ index files;
+ instant-upload codes, offline-download codes, content addresses;
+ share links and public metadata that third parties can scrape;
+ publicly queryable object IDs.

Only by treating these "identity signals" as assets to be managed will a platform avoid hardening review at the front door while exposing content identity as a low-cost capability through the back door.

### 7. The most realistic engineering conclusion: accept the trade-off, and do not chase the fantasy of "zero-cost secure deduplication"
This class of problems ultimately always returns to the same reality: **there is no zero-cost three-way balance among deduplication efficiency, user experience, and privacy boundaries.**

If the goals are:

+ maximize cross-user deduplication;
+ maximize the instant-upload success rate;
+ minimize upload cost;
+ while fully hiding file existence, ownership, and content identity;

then it usually cannot be done.

A genuinely mature solution does not try to deny the trade-off; it clearly partitions:

+ which data merits global deduplication;
+ which data may only be deduplicated within a domain;
+ which data should rather be stored several extra times than expose a stable identity;
+ which scenarios must use PoW, randomization, or a unified upload flow to cancel out the side channel.

From the defense perspective, this is far more honest — and far more effective — than simply claiming "hashes are irreversible, so there is no risk."

## VIII. A Judgment on "Instant Upload Was Abused by Black-Market Actors, So the Feature Was Suspended"
A common claim is that many Chinese platforms once offered "instant upload," and later suspended it because black-market actors routinely abused it to distribute malicious or infringing files.

Combining the material from this round of research, I believe a **fairly safe** conclusion can be drawn:

1. **"Cloud drive capabilities such as sharing, saving-to-drive, offline download, and instant upload have long been used for infringing distribution"** — this point is supported by ample public evidence.
2. **"Chinese platforms have been under sustained copyright and content-governance pressure for over a decade"** — this point is likewise supported by regulatory documents, media reports, and case law.
3. **"Some platforms did indeed shrink, shut down, or tighten these capabilities"** — this point also has historical milestones, such as 115 and 360.
4. But to state it very strictly: **"Baidu Netdisk and Quark Cloud Drive explicitly took instant-upload-by-hash offline because it was abused by black-market actors"** — I have not found sufficiently strong official public statements supporting that precise a causal chain.

So when writing a report, it is best to phrase it as:

**The hash-driven fast-transfer and sharing capabilities of Chinese cloud drives have long been embedded in a governance context of infringing distribution and gray/black-market abuse; the tightening of these capabilities by platforms is at least highly correlated with copyright, illegal-content distribution, and risk-control pressure.**

That is the safer formulation.

## IX. Impact Scope for Object Storage: Do Mainstream S3/OSS and the Open-Source Community Have Similar Oracles?
![](https://cdn.nlark.com/yuque/0/2026/png/166008/1776817128662-32380d31-1fcd-48d2-9787-3ceb432e610f.png)

Extending the discussion further to object storage, the conclusions come out finer-grained than in the cloud drive context.

### 1. Mainstream object storage is by default not a "content-fingerprint-driven" product
Whether Amazon S3 or Alibaba Cloud OSS, the public documentation grounds object identity in **bucket + object key**, not in a content hash. The OSS documentation explicitly states that each object is uniquely identified within a bucket by its object key. [OSS overview](https://www.alibabacloud.com/help/en/oss/user-guide/oss-overview)

S3's official blog states the same fact from the other direction: in S3, **duplicate objects are allowed to exist**, and the official approach to "identifying duplicate objects" is after-the-fact analysis and cleanup using Inventory + Athena + ETag, not S3 automatically collapsing identical content into a shared object at the object-API layer. [AWS Storage Blog](https://aws.amazon.com/blogs/storage/managing-duplicate-objects-in-amazon-s3/)

This means that in terms of default semantics, S3/OSS do not expose "content-hash hit" as a user-perceivable primary path the way cloud drive "instant upload" does. At least at the public API layer, they default to:

+ **key-name addressing**, not content addressing;
+ **object existence centered on the key**, not on a content hash;
+ **integrity check values used for verification and concurrency control**, not by default for cross-user content reuse.

This directly changes the risk intensity.

### 2. But they do have weaker oracles: key existence and ETag conditional requests
Although there is no strong "hash instant-upload" oracle by default, mainstream object storage widely supports conditional requests.

Amazon S3's official documentation explicitly states:

+ `If-None-Match` can check at write time whether a given key already exists;
+ `If-Match` can check an object's current state at write time using the ETag;
+ using these conditional writes requires the corresponding permissions, and these capabilities themselves "enable the caller to check" object existence or ETag state. [S3 conditional writes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html)

Alibaba Cloud OSS likewise offers conditional downloads based on ETag and modification time; when a request's conditions are not satisfied, it returns `304 Not Modified` or `412 Precondition Failed` instead of the object body. [OSS conditional download](https://www.alibabacloud.com/help/en/oss/user-guide/conditional-download)

From a red team perspective, this means object storage, while not exposing a "content deduplication oracle" by default, still has two weaker classes of oracle:

+ **key existence oracle**: knowing the bucket and key, and holding the corresponding write permission, one can use `If-None-Match` to determine whether a key exists;
+ **ETag state oracle**: knowing an object's ETag and holding the corresponding read/write permissions, one can use conditional requests to determine the object's version state.

However, the risk intensity of these oracles differs from cloud drive instant upload, in that:

+ they usually require an **explicit object path**, not merely a content fingerprint;
+ they usually require **pre-existing authorization**, rather than turning content identity directly into a cross-user sharing entry;
+ what they mainly expose is **key-level or object-state-level information**, not global content existence.

Therefore, if one insists on an analogy, these are more like "object state oracles" than "content identity oracles."

### 3. ETag is not a stable content identity, which actually weakens the "hash as capability" risk
S3's official documentation also stresses one point: the relationship between object checksums and the ETag is not always stable.

+ S3 now supports multiple checksum algorithms;
+ in multipart upload scenarios, an object's ETag is not the MD5 of the entire object's content;
+ in many scenarios the ETag should be understood as an implementation-dependent object identifier, not a stable, portable content hash. [S3 object integrity](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html)

The AWS official blog, when discussing duplicate-object identification, also explicitly notes that ETag-based dedup only applies to a subset of objects and does not hold for multipart, SSE-KMS, SSE-C, and similar scenarios. [AWS Storage Blog](https://aws.amazon.com/blogs/storage/managing-duplicate-objects-in-amazon-s3/)

This point is key. It means mainstream object storage, although it exposes the ETag, **has not designed the ETag as a strong, stable, globally unified content identity.** This actually weakens, to a certain extent, the risk of "know one digest, reuse the content globally."

### 4. The genuinely dangerous patterns in object storage usually appear in "peripheral systems," not the core object API
Looking only at the S3/OSS core object API, the risks lean toward:

+ key exposure;
+ presigned URL exposure;
+ bucket policy misconfiguration;
+ conditional requests used as existence probes;
+ ETags or metadata mistaken by upper-layer applications for stable identity.

The dangerous patterns closer to the cloud drive "instant-upload oracle" usually appear in peripheral systems, for example:

+ a gateway layer implementing cross-user deduplication itself;
+ backup/archival systems doing single-instance reuse on top of object storage;
+ upper-layer business using content hashes as object names;
+ sample platforms using the object hash as both index key and download key;
+ application layers building "instant-upload codes," "offline save-to-drive codes," or "resource fingerprint codes" around object storage.

In other words, **S3/OSS themselves are usually not the strongest source of oracles, but they often serve as the hosting substrate for such oracles.**

### 5. The situation in the open-source community: the risk exists, but is unevenly distributed
Extending the scope to common open-source object stores reveals three different tiers of situation.

#### 5.1 MinIO: by default an S3-compatible object store, not a content-deduplication system
For MinIO today, the most urgent thing to confirm is not "does it have a dedup oracle," but its maintenance status.

As of **February 13, 2026**, MinIO's official GitHub repository has been archived read-only; the README states outright: **"THIS REPOSITORY IS NO LONGER MAINTAINED."** It further states that the community edition has switched to **source-only distribution**, with no more prebuilt binary updates. [GitHub repository README](https://github.com/minio/minio), [post-archive issue page](https://github.com/minio/minio/issues/21715)

This leads to a very concrete impact-scope judgment:

+ **the MinIO community edition remains usable, but its maintenance risk has risen significantly**;
+ the risk is not that it inherently contains a strong "hash instant-upload" oracle;
+ the risk is that it retains S3-compatible semantics while the community-edition project itself has entered an unmaintained state.

In terms of API semantics, the MinIO/AIStor documentation explicitly supports conditional operations such as `If-Match` and `If-None-Match`, consistent with the S3 model. [MinIO S3 API Compatibility](https://docs.min.io/enterprise/aistor-object-store/developers/s3-api-compatibility/)

Therefore, the more accurate statement about MinIO is:

**What it inherits by default is the S3-style object-state oracle, not a cloud-drive-style content-deduplication oracle; but since the community edition has stopped being maintained, any upper-layer system built on these semantics needs to re-evaluate its patching and exposure-surface risk.**

#### 5.2 Ceph RGW: standard conditional requests exist by default; the genuinely dangerous dedup is an explicit feature
Ceph RGW's S3/Swift documentation both support ETag-based conditional GET/HEAD/COPY, as part of standard object storage semantics. [Ceph S3 object ops](https://docs.ceph.com/en/latest/radosgw/s3/objectops/), [Ceph Swift object ops](https://docs.ceph.com/en/latest/radosgw/swift/objectops/)

But more noteworthy is that Ceph's official documentation does include **Full RGW Object Deduplication**. That documentation is very direct:

+ this is a dedup feature;
+ executed with `radosgw-admin dedup exec`;
+ the documentation explicitly warns: **"This command can lead to data loss and should not be used on production data!!"** [Ceph dedup docs](https://docs.ceph.com/en/latest/radosgw/s3_objects_dedup/)

This shows that in the open-source community, similar risks do exist — they just are usually not default product semantics, but rather:

+ an explicit background administration feature;
+ requiring an administrator to actively enable it;
+ with the risk directly flagged in the official documentation.

Therefore, Ceph's impact scope can be summarized as:

+ default object API: mainly key/ETag-level oracles;
+ optional dedup feature: carries stronger content-reuse risk, but is not the default surface, and the official documentation has explicitly warned it is unsuitable for production.

#### 5.3 OpenStack Swift: has conditional requests, but proactively mitigates leakage in its encryption design
Swift likewise supports `If[-None]-Match`-style conditional semantics, but its object encryption documentation specifically discusses a key issue:

once objects are encrypted, using the plaintext ETag directly for conditional comparison leaks unnecessary information. To address this, Swift's encryption middleware does not expose the plaintext ETag directly; instead it stores and compares `HMAC(object_key, ETag)`, allowing the backend to complete the conditional check while avoiding directly revealing the ETag or object-body-related information. [Swift object encryption](https://docs.openstack.org/swift/2.11.0/overview_encryption.html)

This is an example very much worth including in the main text, because it shows:

**The open-source community does not merely "also have the risk" — it has already produced a relatively mature class of mitigation designs: keep the conditional-request capability, but do not expose the stable content identity as-is.**

### 6. Final judgment on the impact scope
Synthesizing the mainstream cloud object stores and open-source community material, the impact scope can be divided into three tiers.

#### Tier 1: default object storage semantics
Typical representatives: Amazon S3, Alibaba Cloud OSS, MinIO, Ceph RGW, OpenStack Swift.

These systems by default are mostly:

+ key-addressed;
+ ETag/conditional-request capable;
+ not doing cross-user reuse by content hash by default;
+ and therefore exposing by default an **object-state oracle**, not the strongest **content-deduplication oracle**.

#### Tier 2: optional deduplication or background optimization features
Typical representatives: Ceph RGW dedup, backup and archival systems, single-instance layers built on top of object storage.

These systems begin to approach the core risk discussed in this article, because they convert "identical content" into internal reuse, and if the hit state is externally observable, the risk intensifies quickly.

#### Tier 3: upper-layer businesses productizing content identity directly
Typical representatives: cloud drive instant upload, sample platforms downloading by hash, content-addressed networks, application-layer custom "resource fingerprint codes."

This tier is the closest to the strong-oracle pattern of "know one short fingerprint, retrieve or confirm a large object," and is the high-risk zone this article focuses on most.

Therefore, if one clear impact-scope judgment is needed, it can be written as:

**Mainstream object stores do not, by default, broadly expose the strong content oracle of the cloud-drive instant-upload kind, but key/ETag-level conditional-request semantics are pervasive; the genuinely high-risk patterns appear more in the dedup, gateway, backup, sample-retrieval, and application-layer content-identity systems built on top of object storage.**

## X. Final Conclusions
My overall judgment after this round of research can be compressed into three sentences.

First, **whether a file hash leak is harmful cannot be judged by "is the hash reversible" alone; it depends on whether the system treats it as content identity or an access entry point.**

Second, **from the perspective of real attack surfaces, the most dangerous role of a hash is not "recovering the original," but "confirming existence, narrowing the candidate space, hitting the index, triggering mappings, and correlating intelligence."**

Third, **therefore "a file hash's confidentiality equals that of the file itself" is not a universal truth — but in scenarios such as deduplication, instant upload, content addressing, sample lookup, and templated private files, this judgment comes very close to reality.**

If this survey had to be condensed into one sentence, I would write:

**A hash is not the file itself — but when a system treats the hash as a verifiable stand-in for the file, leaking the hash can amount to leaking the key that leads to the file.**

## References
### Chinese-Language Sources
1. Cyberspace Administration of China repost, "IPR Regulation Seals Off the 'Vacuum Zone': Cloud Drives Can No Longer Freely Share American TV Shows"  
[https://www.cac.gov.cn/2015-10/26/c_1116934785.htm](https://www.cac.gov.cn/2015-10/26/c_1116934785.htm)
2. Supreme People's Court Intellectual Property Court: "Determining Conduct and Clarifying Rule Application — Excerpted Remarks from the Workshop on Infringement Risk Prevention and Legal Liability of Online Platforms Under New Quality Productive Forces"  
[https://ipc.court.gov.cn/zh-cn/news/view-3592.html](https://ipc.court.gov.cn/zh-cn/news/view-3592.html)
3. Center for Coordination and Innovation of Judicial Civilization: "The Technical Logic and Legal Characterization of Instant-Upload-Style Offline Downloading"  
[https://www.cicjc.com.cn/info/1041/16442.htm](https://www.cicjc.com.cn/info/1041/16442.htm)
4. Dezhou Intermediate People's Court repost: "Users Rampantly Share Hit Drama Series via Cloud Drive; Youku Sues Baidu and Wins 1 Million in First Instance"  
[https://www.sdcourt.gov.cn/dzzy/392143/392145/5818823/index.html](https://www.sdcourt.gov.cn/dzzy/392143/392145/5818823/index.html)
5. CCTV repost: 115 Cloud Drive shuts down public sharing  
[https://news.cntv.cn/20120807/118674.shtml](https://news.cntv.cn/20120807/118674.shtml)
6. Xinhuanet: reports on 360 Cloud Drive ending its personal cloud drive service  
[https://www.xinhuanet.com/zgjx/2016-10/21/c_135770840.htm](https://www.xinhuanet.com/zgjx/2016-10/21/c_135770840.htm)
7. Baidu Netdisk Enterprise Edition article, "Instant-Upload Technology: Dissecting the Speed Gene of Private-Deployment Cloud Drives"  
[https://eyun.baidu.com/content/522730/](https://eyun.baidu.com/content/522730/)
8. People's Daily: reports on drive-search engines scraping public Baidu Netdisk share links  
[https://it.people.com.cn/GB/n1/2017/0722/c1009-29422086.html](https://it.people.com.cn/GB/n1/2017/0722/c1009-29422086.html)
9. Alibaba Cloud OSS conditional download  
[https://www.alibabacloud.com/help/en/oss/user-guide/conditional-download](https://www.alibabacloud.com/help/en/oss/user-guide/conditional-download)
10. Alibaba Cloud OSS overview  
[https://www.alibabacloud.com/help/en/oss/user-guide/oss-overview](https://www.alibabacloud.com/help/en/oss/user-guide/oss-overview)

### English-Language Sources
1. Harnik, Pinkas, Shulman-Peleg, _Side Channels in Cloud Services: Deduplication in Cloud Storage_  
[https://www.pinkas.net/PAPERS/hps.pdf](https://www.pinkas.net/PAPERS/hps.pdf)
2. Halevi et al., _Proofs of Ownership in Remote Storage Systems_  
[https://eprint.iacr.org/2011/207](https://eprint.iacr.org/2011/207)
3. Bellare, Keelveedhi, Ristenpart, _Message-Locked Encryption and Secure Deduplication_  
[https://eprint.iacr.org/2012/631](https://eprint.iacr.org/2012/631)
4. Bellare, Keelveedhi, Ristenpart, _DupLESS_  
[https://eprint.iacr.org/2013/429.pdf](https://eprint.iacr.org/2013/429.pdf)
5. Tahoe-LAFS Documentation  
[https://tahoe-lafs.readthedocs.io/_/downloads/en/tahoe-lafs-1.14.0/pdf/](https://tahoe-lafs.readthedocs.io/_/downloads/en/tahoe-lafs-1.14.0/pdf/)
6. Bacs et al., _DUPEFS: Leaking Data Over the Network With Filesystem Deduplication Side Channels_  
[https://www.usenix.org/conference/fast22/presentation/bacs](https://www.usenix.org/conference/fast22/presentation/bacs)
7. Tolia et al., _Opportunistic Use of Content Addressable Storage for Distributed File Systems_  
[https://www.usenix.org/event/usenix03/tech/full_papers/tolia/tolia_html/usenix03.html](https://www.usenix.org/event/usenix03/tech/full_papers/tolia/tolia_html/usenix03.html)
8. IPFS Docs, _Privacy and encryption_  
[https://docs.ipfs.tech/concepts/privacy-and-encryption/](https://docs.ipfs.tech/concepts/privacy-and-encryption/)
9. VirusTotal Docs, _Files_  
[https://docs.virustotal.com/reference/files](https://docs.virustotal.com/reference/files)
10. VirusTotal Docs, _Download a file_  
[https://docs.virustotal.com/reference/files-download](https://docs.virustotal.com/reference/files-download)
11. MalwareBazaar Community API  
[https://bazaar.abuse.ch/hunting/yara/remsec_encrypted_api/](https://bazaar.abuse.ch/hunting/yara/remsec_encrypted_api/)
12. NIST NSRL FAQ  
[https://www.nist.gov/itl/ssd/software-quality-group/national-software-reference-library-nsrl/about-nsrl/nsrl-frequently-0](https://www.nist.gov/itl/ssd/software-quality-group/national-software-reference-library-nsrl/about-nsrl/nsrl-frequently-0)
13. Fedora Project, download verification  
[https://fedoraproject.org/en/security/](https://fedoraproject.org/en/security/)
14. Debian, verifying authenticity of images  
[https://www.debian.org/CD/verify.en.html](https://www.debian.org/CD/verify.en.html)
15. Ubuntu, how to verify your download  
[https://ubuntu.com/tutorials/how-to-verify-ubuntu](https://ubuntu.com/tutorials/how-to-verify-ubuntu)
16. Amazon S3 conditional writes  
[https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html)
17. Amazon S3 object integrity  
[https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html)
18. AWS Storage Blog, managing duplicate objects in Amazon S3  
[https://aws.amazon.com/blogs/storage/managing-duplicate-objects-in-amazon-s3/](https://aws.amazon.com/blogs/storage/managing-duplicate-objects-in-amazon-s3/)
19. MinIO GitHub repository  
[https://github.com/minio/minio](https://github.com/minio/minio)
20. Ceph RGW S3 object operations  
[https://docs.ceph.com/en/latest/radosgw/s3/objectops/](https://docs.ceph.com/en/latest/radosgw/s3/objectops/)
21. Ceph RGW full object deduplication  
[https://docs.ceph.com/en/latest/radosgw/s3_objects_dedup/](https://docs.ceph.com/en/latest/radosgw/s3_objects_dedup/)
22. OpenStack Swift object encryption  
[https://docs.openstack.org/swift/2.11.0/overview_encryption.html](https://docs.openstack.org/swift/2.11.0/overview_encryption.html)
23. MinIO S3 API Compatibility  
[https://docs.min.io/enterprise/aistor-object-store/developers/s3-api-compatibility/](https://docs.min.io/enterprise/aistor-object-store/developers/s3-api-compatibility/)
