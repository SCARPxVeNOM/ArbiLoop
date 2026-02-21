// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ArbiLoopVaultArbitrum
 * @notice Lightweight Arbitrum loop executor for Aave-compatible pools.
 * @dev Exposes dedicated Aave and Radiant leverage entrypoints.
 */

interface IERC20Lite {
    function balanceOf(address account) external view returns (uint256);
}

interface IAavePoolLite {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function borrow(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        uint16 referralCode,
        address onBehalfOf
    ) external;
}

contract ArbiLoopVaultArbitrum {
    address public owner;
    address public immutable pool;

    bytes4 private constant _TRANSFER = 0xa9059cbb;
    bytes4 private constant _TRANSFER_FROM = 0x23b872dd;
    bytes4 private constant _APPROVE = 0x095ea7b3;

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address poolAddress) {
        require(poolAddress != address(0), "pool=0");
        owner = msg.sender;
        pool = poolAddress;
    }

    function setOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "owner=0");
        owner = newOwner;
    }

    function leverageAave(
        address inputToken,
        address supplyAsset,
        address borrowAsset,
        uint256 amount,
        uint256 /* legacyExtraAmount */,
        uint256 borrowAmount,
        address /* legacyRouteHint */
    ) external payable {
        require(msg.value == 0, "native off");
        _runLoop(inputToken, supplyAsset, borrowAsset, amount, borrowAmount);
    }

    function leverageRadiant(
        address inputToken,
        address supplyAsset,
        address borrowAsset,
        uint256 amount,
        uint256 /* legacyExtraAmount */,
        uint256 borrowAmount,
        address /* legacyRouteHint */
    ) external payable {
        require(msg.value == 0, "native off");
        _runLoop(inputToken, supplyAsset, borrowAsset, amount, borrowAmount);
    }

    function emergencySweep(address token, uint256 amount) external onlyOwner {
        _tokenCall(token, abi.encodeWithSelector(_TRANSFER, owner, amount));
    }

    function _runLoop(
        address inputToken,
        address supplyAsset,
        address borrowAsset,
        uint256 amount,
        uint256 borrowAmount
    ) internal {
        require(inputToken == supplyAsset, "input!=supply");
        require(amount > 0 && borrowAmount > 0, "bad amount");

        _tokenCall(
            inputToken,
            abi.encodeWithSelector(_TRANSFER_FROM, msg.sender, address(this), amount)
        );
        _tokenCall(inputToken, abi.encodeWithSelector(_APPROVE, pool, 0));
        _tokenCall(inputToken, abi.encodeWithSelector(_APPROVE, pool, amount));

        IAavePoolLite(pool).supply(supplyAsset, amount, msg.sender, 0);
        IAavePoolLite(pool).borrow(borrowAsset, borrowAmount, 2, 0, msg.sender);

        uint256 borrowed = IERC20Lite(borrowAsset).balanceOf(address(this));
        if (borrowed > 0) {
            _tokenCall(borrowAsset, abi.encodeWithSelector(_TRANSFER, msg.sender, borrowed));
        }
    }

    function _tokenCall(address token, bytes memory data) internal {
        (bool ok, bytes memory ret) = token.call(data);
        require(ok, "token call fail");
        if (ret.length > 0) {
            require(abi.decode(ret, (bool)), "token op fail");
        }
    }
}
