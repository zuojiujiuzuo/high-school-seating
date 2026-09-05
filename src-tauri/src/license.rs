use std::{fs, path::PathBuf};

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use chrono::{Duration, NaiveDate, Utc};
use ed25519_dalek::{pkcs8::DecodePublicKey, Signature, VerifyingKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::Manager;

const PRODUCT_ID: &str = "cn.banzhen.seating";
const PRODUCT_NAME: &str = "班阵";
const LICENSE_FILE_NAME: &str = "license.zj-license";
const MAX_LICENSE_SIZE: usize = 64 * 1024;
const PUBLIC_KEY_PEM: &str = include_str!("../license_public_key.pem");

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LicenseClaims {
    pub schema_version: u8,
    pub product: String,
    pub product_id: String,
    pub license_id: String,
    pub licensee: String,
    pub edition: String,
    pub issued_at: String,
    pub expires_at: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct LicenseEnvelope {
    license: LicenseClaims,
    algorithm: String,
    signature: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum LicenseState {
    Licensed,
    Missing,
    Invalid,
    Expired,
    Misconfigured,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LicenseStatus {
    pub state: LicenseState,
    pub product: String,
    pub app_version: String,
    pub license_id: Option<String>,
    pub licensee: Option<String>,
    pub edition: Option<String>,
    pub issued_at: Option<String>,
    pub expires_at: Option<String>,
    pub verification_code: Option<String>,
    pub message: String,
}

impl LicenseStatus {
    fn basic(state: LicenseState, message: impl Into<String>) -> Self {
        Self {
            state,
            product: PRODUCT_NAME.to_string(),
            app_version: env!("CARGO_PKG_VERSION").to_string(),
            license_id: None,
            licensee: None,
            edition: None,
            issued_at: None,
            expires_at: None,
            verification_code: None,
            message: message.into(),
        }
    }

    fn from_claims(
        state: LicenseState,
        claims: &LicenseClaims,
        verification_code: String,
        message: impl Into<String>,
    ) -> Self {
        Self {
            state,
            product: claims.product.clone(),
            app_version: env!("CARGO_PKG_VERSION").to_string(),
            license_id: Some(claims.license_id.clone()),
            licensee: Some(claims.licensee.clone()),
            edition: Some(claims.edition.clone()),
            issued_at: Some(claims.issued_at.clone()),
            expires_at: claims.expires_at.clone(),
            verification_code: Some(verification_code),
            message: message.into(),
        }
    }
}

fn parse_date(value: &str) -> Result<NaiveDate, ()> {
    NaiveDate::parse_from_str(value, "%Y-%m-%d").map_err(|_| ())
}

fn verification_code(canonical: &[u8], signature: &[u8]) -> String {
    let digest = Sha256::new()
        .chain_update(canonical)
        .chain_update(signature)
        .finalize();
    digest[..6]
        .chunks(2)
        .map(|chunk| {
            chunk
                .iter()
                .map(|byte| format!("{byte:02X}"))
                .collect::<String>()
        })
        .collect::<Vec<_>>()
        .join("-")
}

fn verify_content_with_key(content: &str, key: &VerifyingKey, today: NaiveDate) -> LicenseStatus {
    if content.len() > MAX_LICENSE_SIZE {
        return LicenseStatus::basic(LicenseState::Invalid, "授权文件过大，无法验证");
    }

    let envelope: LicenseEnvelope = match serde_json::from_str(content) {
        Ok(envelope) => envelope,
        Err(_) => return LicenseStatus::basic(LicenseState::Invalid, "授权文件格式不正确"),
    };

    if envelope.algorithm != "Ed25519" {
        return LicenseStatus::basic(LicenseState::Invalid, "授权文件使用了不支持的签名算法");
    }

    let canonical = match serde_json::to_vec(&envelope.license) {
        Ok(value) => value,
        Err(_) => return LicenseStatus::basic(LicenseState::Invalid, "授权内容无法解析"),
    };
    let signature_bytes = match BASE64.decode(envelope.signature.as_bytes()) {
        Ok(value) => value,
        Err(_) => return LicenseStatus::basic(LicenseState::Invalid, "授权签名格式不正确"),
    };
    let signature = match Signature::from_slice(&signature_bytes) {
        Ok(value) => value,
        Err(_) => return LicenseStatus::basic(LicenseState::Invalid, "授权签名长度不正确"),
    };
    if key.verify_strict(&canonical, &signature).is_err() {
        return LicenseStatus::basic(LicenseState::Invalid, "授权签名验证失败，文件可能已被修改");
    }

    let code = verification_code(&canonical, &signature_bytes);
    let claims = envelope.license;
    if claims.schema_version != 1
        || claims.product_id != PRODUCT_ID
        || claims.product != PRODUCT_NAME
    {
        return LicenseStatus::from_claims(
            LicenseState::Invalid,
            &claims,
            code,
            "该授权文件不适用于当前软件",
        );
    }
    if claims.license_id.trim().is_empty()
        || claims.licensee.trim().is_empty()
        || claims.edition.trim().is_empty()
    {
        return LicenseStatus::from_claims(
            LicenseState::Invalid,
            &claims,
            code,
            "授权编号、授权对象或版本不能为空",
        );
    }

    let issued_at = match parse_date(&claims.issued_at) {
        Ok(value) => value,
        Err(_) => {
            return LicenseStatus::from_claims(
                LicenseState::Invalid,
                &claims,
                code,
                "授权签发日期格式不正确",
            )
        }
    };
    if issued_at > today + Duration::days(1) {
        return LicenseStatus::from_claims(
            LicenseState::Invalid,
            &claims,
            code,
            "授权签发日期晚于本机日期",
        );
    }

    if let Some(expires_at) = claims.expires_at.as_deref() {
        let expiry = match parse_date(expires_at) {
            Ok(value) => value,
            Err(_) => {
                return LicenseStatus::from_claims(
                    LicenseState::Invalid,
                    &claims,
                    code,
                    "授权到期日期格式不正确",
                )
            }
        };
        if expiry < issued_at {
            return LicenseStatus::from_claims(
                LicenseState::Invalid,
                &claims,
                code,
                "授权到期日期早于签发日期",
            );
        }
        if expiry < today {
            return LicenseStatus::from_claims(
                LicenseState::Expired,
                &claims,
                code,
                "授权已到期，请导入新的授权文件",
            );
        }
    }

    LicenseStatus::from_claims(LicenseState::Licensed, &claims, code, "数字签名验证通过")
}

fn verify_content(content: &str) -> LicenseStatus {
    let key = match VerifyingKey::from_public_key_pem(PUBLIC_KEY_PEM) {
        Ok(value) => value,
        Err(_) => {
            return LicenseStatus::basic(
                LicenseState::Misconfigured,
                "应用未配置有效的授权验证公钥，请联系软件发布方",
            )
        }
    };
    verify_content_with_key(content, &key, Utc::now().date_naive())
}

fn license_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|directory| directory.join("license").join(LICENSE_FILE_NAME))
        .map_err(|error| format!("无法定位本机授权目录：{error}"))
}

#[tauri::command]
pub fn get_license_status(app: tauri::AppHandle) -> LicenseStatus {
    let path = match license_path(&app) {
        Ok(value) => value,
        Err(message) => return LicenseStatus::basic(LicenseState::Misconfigured, message),
    };
    let content = match fs::read_to_string(path) {
        Ok(value) => value,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return LicenseStatus::basic(LicenseState::Missing, "尚未导入班阵离线授权文件")
        }
        Err(error) => {
            return LicenseStatus::basic(
                LicenseState::Invalid,
                format!("无法读取本机授权文件：{error}"),
            )
        }
    };
    verify_content(&content)
}

#[tauri::command]
pub fn install_license(app: tauri::AppHandle, content: String) -> Result<LicenseStatus, String> {
    let status = verify_content(&content);
    if status.state != LicenseState::Licensed {
        return Ok(status);
    }

    let path = license_path(&app)?;
    let parent = path.parent().ok_or_else(|| "授权目录无效".to_string())?;
    fs::create_dir_all(parent).map_err(|error| format!("无法创建授权目录：{error}"))?;
    fs::write(&path, content).map_err(|error| format!("无法保存授权文件：{error}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&path, fs::Permissions::from_mode(0o600))
            .map_err(|error| format!("无法保护授权文件权限：{error}"))?;
    }
    Ok(status)
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};

    fn signed_license(key: &SigningKey, expires_at: Option<&str>) -> String {
        let claims = LicenseClaims {
            schema_version: 1,
            product: PRODUCT_NAME.to_string(),
            product_id: PRODUCT_ID.to_string(),
            license_id: "BZ-TEST-0001".to_string(),
            licensee: "测试学校".to_string(),
            edition: "正式版".to_string(),
            issued_at: "2026-09-01".to_string(),
            expires_at: expires_at.map(str::to_string),
        };
        let canonical = serde_json::to_vec(&claims).unwrap();
        let signature = key.sign(&canonical);
        serde_json::json!({
            "license": claims,
            "algorithm": "Ed25519",
            "signature": BASE64.encode(signature.to_bytes()),
        })
        .to_string()
    }

    #[test]
    fn accepts_a_valid_offline_license() {
        let signing_key = SigningKey::from_bytes(&[7_u8; 32]);
        let status = verify_content_with_key(
            &signed_license(&signing_key, None),
            &signing_key.verifying_key(),
            NaiveDate::from_ymd_opt(2026, 9, 5).unwrap(),
        );
        assert_eq!(status.state, LicenseState::Licensed);
        assert_eq!(status.licensee.as_deref(), Some("测试学校"));
        assert!(status.verification_code.is_some());
    }

    #[test]
    fn embedded_release_public_key_is_valid() {
        assert!(VerifyingKey::from_public_key_pem(PUBLIC_KEY_PEM).is_ok());
    }

    #[test]
    fn rejects_tampering() {
        let signing_key = SigningKey::from_bytes(&[7_u8; 32]);
        let content = signed_license(&signing_key, None).replace("测试学校", "冒用学校");
        let status = verify_content_with_key(
            &content,
            &signing_key.verifying_key(),
            NaiveDate::from_ymd_opt(2026, 9, 5).unwrap(),
        );
        assert_eq!(status.state, LicenseState::Invalid);
    }

    #[test]
    fn reports_an_expired_license() {
        let signing_key = SigningKey::from_bytes(&[7_u8; 32]);
        let status = verify_content_with_key(
            &signed_license(&signing_key, Some("2026-09-04")),
            &signing_key.verifying_key(),
            NaiveDate::from_ymd_opt(2026, 9, 5).unwrap(),
        );
        assert_eq!(status.state, LicenseState::Expired);
    }
}
